import { describe, expect, test } from "vitest";
import { featureVisible, parseFeatureMode } from "./lib/featureMode";

const guest = { isMember: false, isAdmin: false };
const member = { isMember: true, isAdmin: false };
const admin = { isMember: true, isAdmin: true };

describe("featureVisible", () => {
  test("off is hidden from everyone", () => {
    expect(featureVisible("off", guest)).toBe(false);
    expect(featureVisible("off", admin)).toBe(false);
  });

  test("on is visible to guests, members, and admins", () => {
    expect(featureVisible("on", guest)).toBe(true);
    expect(featureVisible("on", member)).toBe(true);
    expect(featureVisible("on", admin)).toBe(true);
  });

  test("members is hidden from guests and visible to user and admin", () => {
    expect(featureVisible("members", guest)).toBe(false);
    expect(featureVisible("members", member)).toBe(true);
    expect(featureVisible("members", admin)).toBe(true);
  });

  test("adminOnly is visible only to admins", () => {
    expect(featureVisible("adminOnly", guest)).toBe(false);
    expect(featureVisible("adminOnly", member)).toBe(false);
    expect(featureVisible("adminOnly", admin)).toBe(true);
  });

  test("parseFeatureMode accepts members and treats unknown as off", () => {
    expect(parseFeatureMode("members")).toBe("members");
    expect(parseFeatureMode("nope")).toBe("off");
    expect(parseFeatureMode(true)).toBe("on");
    expect(parseFeatureMode(false)).toBe("off");
  });
});
