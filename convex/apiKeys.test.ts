import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { sha256Hex } from "./apiKeys/token";
import { registerAggregate } from "../tests/registerAggregate";

const modules = import.meta.glob("./**/*.ts");

process.env.API_KEY_ENCRYPTION_KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));

function createT() {
  const t = convexTest(schema, modules);
  registerAggregate(t);
  return t;
}

async function seedUser(t: ReturnType<typeof createT>, userType: string) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: `${userType}@example.com`,
      name: userType,
      userType,
    });
  });
  return t.withIdentity({ subject: `${userId}|testsession` });
}

describe("blog API keys", () => {
  test("only an admin can create and re-read a key encrypted at rest", async () => {
    const t = createT();
    const reader = await seedUser(t, "user");
    await expect(reader.mutation(api.apiKeys.mutations.create, { name: "writer" })).rejects.toThrow(
      /Forbidden/,
    );

    const admin = await seedUser(t, "admin");
    const created = await admin.mutation(api.apiKeys.mutations.create, {
      name: "writer",
    });
    expect(created.token).toMatch(/^blg_[0-9a-f]{64}$/);
    const stored = await t.run(async (ctx) => ctx.db.get("apiKeys", created.key._id));
    expect(stored?.tokenHash).not.toBe(created.token);
    expect(stored?.encryptedToken).not.toContain(created.token);
    expect(stored?.tokenPrefix).toBe(created.token.slice(0, 12));

    const revealed = await admin.mutation(api.apiKeys.mutations.reveal, {
      keyId: created.key._id,
    });
    expect(revealed.token).toBe(created.token);
    await expect(
      reader.mutation(api.apiKeys.mutations.reveal, {
        keyId: created.key._id,
      }),
    ).rejects.toThrow(/Forbidden/);
  });

  test("a key creates, updates, publishes, and loses access after revocation", async () => {
    const t = createT();
    const admin = await seedUser(t, "admin");
    const created = await admin.mutation(api.apiKeys.mutations.create, {
      name: "writer",
    });

    const draft = await t.mutation(internal.apiKeys.internal.createPost, {
      token: created.token,
      input: {
        title: "Agent draft",
        body: "Work in progress",
        tags: ["agent"],
        published: false,
      },
    });
    expect(draft.status).toBe("draft");

    const published = await t.mutation(internal.apiKeys.internal.updatePost, {
      token: created.token,
      postId: draft.id,
      input: { body: "Finished", published: true },
    });
    expect(published.status).toBe("published");
    const post = await t.query(internal.apiKeys.internal.getPost, {
      token: created.token,
      postId: draft.id,
    });
    expect(post).toMatchObject({
      title: "Agent draft",
      body: "Finished",
      status: "published",
      tags: ["agent"],
    });

    await admin.mutation(api.apiKeys.mutations.revoke, {
      keyId: created.key._id,
    });
    await expect(
      t.query(internal.apiKeys.internal.listPosts, {
        token: created.token,
        limit: 20,
      }),
    ).rejects.toThrow(/Unauthorized/);
  });

  test("images-only does not change API key post reads", async () => {
    const t = createT();
    const admin = await seedUser(t, "admin");
    const created = await admin.mutation(api.apiKeys.mutations.create, {
      name: "writer",
    });
    const draft = await t.mutation(internal.apiKeys.internal.createPost, {
      token: created.token,
      input: {
        title: "Agent draft",
        body: "Keep this paragraph",
        tags: ["agent"],
        published: true,
      },
    });
    await admin.mutation(api.features.mutations.set, { imagesOnly: true });
    const post = await t.query(internal.apiKeys.internal.getPost, {
      token: created.token,
      postId: draft.id,
    });
    expect(post).toMatchObject({
      title: "Agent draft",
      body: "Keep this paragraph",
      tags: ["agent"],
    });
  });

  test("a legacy hash-only key asks for one rotation", async () => {
    const t = createT();
    const admin = await seedUser(t, "admin");
    const keyId = await t.run(async (ctx) => {
      const creator = await ctx.db.query("users").first();
      if (!creator) throw new Error("Missing test administrator");
      return await ctx.db.insert("apiKeys", {
        name: "old writer",
        tokenPrefix: "blg_legacy",
        tokenHash: "a".repeat(64),
        createdBy: creator._id,
      });
    });

    await expect(admin.mutation(api.apiKeys.mutations.reveal, { keyId })).rejects.toThrow(
      /predates saved prompts/,
    );
    const listed = await admin.query(api.apiKeys.queries.list, {});
    expect(listed[0].promptAvailable).toBe(false);

    const rotated = await admin.mutation(api.apiKeys.mutations.rotate, { keyId });
    const revealed = await admin.mutation(api.apiKeys.mutations.reveal, { keyId });
    expect(revealed.token).toBe(rotated.token);
  });

  test("HTTP API creates a visible draft and uploads an image", async () => {
    const t = createT();
    const token = `blg_${"a".repeat(64)}`;
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        email: "admin@example.com",
        name: "admin",
        userType: "admin",
      });
      await ctx.db.insert("apiKeys", {
        name: "writer",
        tokenPrefix: token.slice(0, 12),
        tokenHash: await sha256Hex(token),
        createdBy: userId,
      });
    });
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    const createResponse = await t.fetch("/api/posts", {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "HTTP draft", body: "Starting" }),
    });
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as { post: { id: string } };

    const uploadResponse = await t.fetch(
      `/api/posts/${created.post.id}/assets?filename=test.jpg&alt=Test%20image&cover=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "image/jpeg",
        },
        body: new Blob(["fake jpeg"], { type: "image/jpeg" }),
      },
    );
    expect(uploadResponse.status).toBe(201);
    const uploaded = (await uploadResponse.json()) as {
      asset: { storageId: string; markdown: string };
    };
    expect(uploaded.asset.markdown).toContain(`convex://${uploaded.asset.storageId}`);

    const getResponse = await t.fetch(`/api/posts/${created.post.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getResponse.status).toBe(200);
    const detail = (await getResponse.json()) as {
      post: { title: string; status: string; coverImageId: string; assets: unknown[] };
    };
    expect(detail.post).toMatchObject({
      title: "HTTP draft",
      status: "draft",
      coverImageId: uploaded.asset.storageId,
    });
    expect(detail.post.assets).toHaveLength(1);

    const videoResponse = await t.fetch(
      `/api/posts/${created.post.id}/assets?filename=movie.avi&alt=Movie`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
        },
        body: new Blob(["fake avi"]),
      },
    );
    expect(videoResponse.status).toBe(201);
    const video = (await videoResponse.json()) as {
      asset: { contentType: string; markdown: string };
    };
    expect(video.asset.contentType).toBe("video/x-msvideo");
    expect(video.asset.markdown).toContain("convex://");

    const videoCoverResponse = await t.fetch(
      `/api/posts/${created.post.id}/assets?filename=movie.mov&cover=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "video/quicktime",
        },
        body: new Blob(["fake mov"]),
      },
    );
    expect(videoCoverResponse.status).toBe(400);

    const prepareResponse = await t.fetch(`/api/posts/${created.post.id}/assets/upload-url`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(prepareResponse.status).toBe(200);
    const prepared = (await prepareResponse.json()) as {
      uploadUrl: string;
      expiresInSeconds: number;
    };
    expect(prepared.expiresInSeconds).toBe(3600);

    expect(prepared.uploadUrl).toMatch(/^https?:\/\//);
    // convex-test cannot POST to the platform-owned storage URL, so emulate
    // that one platform step and exercise both application HTTP endpoints.
    const storageId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(["fake zip"], { type: "application/zip" }));
    });

    const attachResponse = await t.fetch(`/api/posts/${created.post.id}/assets/attach`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        storageId,
        filename: "download.zip",
      }),
    });
    expect(attachResponse.status).toBe(201);
    const attached = (await attachResponse.json()) as {
      asset: { contentType: string; markdown: string };
    };
    expect(attached.asset.contentType).toBe("application/zip");
    expect(attached.asset.markdown).toMatch(/^\[Download download\.zip\]\(convex:\/\//);
  });

  describe("agent status", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    async function seedKey(t: ReturnType<typeof createT>) {
      const token = `blg_${"b".repeat(64)}`;
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          email: "admin@example.com",
          name: "admin",
          userType: "admin",
        });
        await ctx.db.insert("apiKeys", {
          name: "agent",
          tokenPrefix: token.slice(0, 12),
          tokenHash: await sha256Hex(token),
          createdBy: userId,
        });
      });
      return token;
    }

    function postStatus(t: ReturnType<typeof createT>, token: string, body: unknown) {
      return t.fetch("/api/agent/status", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    test("throttles same-state updates but lets state and question changes through", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-24T12:00:00Z"));
      const t = createT();
      const token = await seedKey(t);

      const first = await postStatus(t, token, { state: "working", status: "drafting-post" });
      expect(first.status).toBe(200);

      const tooSoon = await postStatus(t, token, { state: "working", status: "uploading-images" });
      expect(tooSoon.status).toBe(429);
      expect(tooSoon.headers.get("Retry-After")).toBe("30");

      const question = await postStatus(t, token, {
        state: "waiting_for_input",
        status: "choosing-cover",
        question: "Chart or screenshot?",
      });
      expect(question.status).toBe(200);

      vi.setSystemTime(new Date("2026-09-24T12:00:31Z"));
      const later = await postStatus(t, token, {
        state: "waiting_for_input",
        status: "still-choosing-cover",
        question: "Chart or screenshot?",
      });
      expect(later.status).toBe(200);

      const admin = t.withIdentity({
        subject: `${await t.run(async (ctx) => (await ctx.db.query("users").first())!._id)}|s`,
      });
      const [listed] = await admin.query(api.apiKeys.queries.list, {});
      expect(listed.agentStatus).toMatchObject({
        state: "waiting_for_input",
        status: "still-choosing-cover",
        question: "Chart or screenshot?",
      });
    });

    test("rejects invalid input and revoked keys", async () => {
      const t = createT();
      const token = await seedKey(t);
      expect((await postStatus(t, token, { state: "sleeping", status: "x" })).status).toBe(400);
      expect((await postStatus(t, token, { state: "working", status: "Not A Slug" })).status).toBe(
        400,
      );
      expect(
        (await postStatus(t, token, { state: "working", status: "drafting", question: "?" }))
          .status,
      ).toBe(400);
      await t.run(async (ctx) => {
        const key = await ctx.db.query("apiKeys").first();
        await ctx.db.patch("apiKeys", key!._id, { revokedAt: Date.now() });
      });
      expect((await postStatus(t, token, { state: "working", status: "drafting" })).status).toBe(
        401,
      );
    });
  });
});
