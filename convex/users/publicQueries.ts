import { v } from "convex/values";
import { query } from "../_generated/server";
import { getAuthedUserIgnoringDisabled } from "../lib/auth";

// Anonymous by design: the client calls this before it knows whether anyone is
// signed in. A disabled user still gets an answer so the UI can say why.
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthedUserIgnoringDisabled(ctx);
    if (!user) {
      return null;
    }
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .take(20);

    const activeSession = sessions
      .filter((s) => s.expirationTime > Date.now())
      .sort((a, b) => b.expirationTime - a.expirationTime)[0];

    const disabled = user.disabledAt !== undefined;
    return {
      ...user,
      sessionExpiresAt: activeSession?.expirationTime ?? null,
      disabled,
      isAdmin: !disabled && user.userType === "admin",
    };
  },
});
