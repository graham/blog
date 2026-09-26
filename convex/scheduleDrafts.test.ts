/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { registerAggregate } from "../tests/registerAggregate";

const modules = import.meta.glob("./**/*.ts");
const MINUTE = 60_000;

function createT() {
  const t = convexTest(schema, modules);
  registerAggregate(t);
  return t;
}

async function seedDrafts(t: ReturnType<typeof createT>, count: number) {
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "admin@example.com", name: "admin", userType: "admin" }),
  );
  const admin = t.withIdentity({ subject: `${userId}|testsession` });
  const postIds: Id<"posts">[] = [];
  for (let i = 0; i < count; i += 1) {
    const postId = await admin.mutation(api.posts.mutations.create, {});
    await admin.mutation(api.posts.mutations.save, {
      postId,
      title: `Draft ${i}`,
      excerpt: "",
      body: "b",
      visibility: "listed",
      tags: [],
    });
    postIds.push(postId);
  }
  return { admin, postIds };
}

describe("batch scheduling drafts", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("schedules the chosen drafts and publishes each at its own time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T09:00:00Z"));
    const t = createT();
    const { admin, postIds } = await seedDrafts(t, 3);
    const now = Date.now();
    const first = now + 15 * MINUTE;
    const second = first + 17 * MINUTE;

    await admin.mutation(api.posts.mutations.scheduleDrafts, {
      items: [
        { postId: postIds[0], publishAt: first },
        { postId: postIds[1], publishAt: second },
      ],
    });

    const read = (postId: Id<"posts">) => t.run(async (ctx) => ctx.db.get("posts", postId));
    expect(await read(postIds[0])).toMatchObject({
      status: "scheduled",
      publishedAt: first,
      createdAt: first,
      updatedAt: first,
    });
    expect(await read(postIds[1])).toMatchObject({ status: "scheduled", publishedAt: second });
    expect(await read(postIds[2])).toMatchObject({ status: "draft" });
    const drafts = await admin.query(api.posts.queries.listDrafts, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(drafts.page.map((post) => post._id)).toEqual([postIds[2]]);
    expect(await admin.query(api.posts.queries.countScheduled, {})).toBe(2);
    await expect(t.query(api.posts.queries.countScheduled, {})).rejects.toThrow(
      /Not authenticated/,
    );

    vi.advanceTimersByTime(first - now);
    await t.finishInProgressScheduledFunctions();
    expect((await read(postIds[0]))?.status).toBe("published");
    expect((await read(postIds[1]))?.status).toBe("scheduled");
    expect(await admin.query(api.posts.queries.countScheduled, {})).toBe(1);

    vi.advanceTimersByTime(second - first);
    await t.finishInProgressScheduledFunctions();
    expect((await read(postIds[1]))?.status).toBe("published");
    expect(await admin.query(api.posts.queries.countScheduled, {})).toBe(0);
  });

  test("rejects past times, non-drafts, and non-admins without changing anything", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T09:00:00Z"));
    const t = createT();
    const { admin, postIds } = await seedDrafts(t, 2);
    const now = Date.now();

    await expect(
      admin.mutation(api.posts.mutations.scheduleDrafts, {
        items: [
          { postId: postIds[0], publishAt: now + 15 * MINUTE },
          { postId: postIds[1], publishAt: now - MINUTE },
        ],
      }),
    ).rejects.toThrow(/in the past/);
    expect((await t.run(async (ctx) => ctx.db.get("posts", postIds[0])))?.status).toBe("draft");

    await expect(
      t.mutation(api.posts.mutations.scheduleDrafts, {
        items: [{ postId: postIds[0], publishAt: now + 15 * MINUTE }],
      }),
    ).rejects.toThrow(/Not authenticated/);

    await admin.mutation(api.posts.mutations.publishNow, { postId: postIds[1] });
    await expect(
      admin.mutation(api.posts.mutations.scheduleDrafts, {
        items: [{ postId: postIds[1], publishAt: now + 15 * MINUTE }],
      }),
    ).rejects.toThrow(/is not a draft/);
  });

  test("drafts are listed newest createdAt first", async () => {
    const t = createT();
    const { admin, postIds } = await seedDrafts(t, 2);
    const base = Date.parse("2026-01-01T00:00:00Z");
    await admin.mutation(api.posts.mutations.setTimes, {
      postId: postIds[0],
      createdAt: base + MINUTE,
      updatedAt: base + MINUTE,
    });
    await admin.mutation(api.posts.mutations.setTimes, {
      postId: postIds[1],
      createdAt: base,
      updatedAt: base,
    });
    const drafts = await admin.query(api.posts.queries.listDrafts, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(drafts.page.map((post) => post._id)).toEqual([postIds[0], postIds[1]]);
  });
});
