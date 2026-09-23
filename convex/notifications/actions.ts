import { internalAction } from "../_generated/server";
import { v } from "convex/values";

export const send = internalAction({
  args: {
    title: v.string(),
    message: v.string(),
    url: v.optional(v.string()),
    urlTitle: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    const token = process.env.PUSHOVER_TOKEN;
    const user = process.env.PUSHOVER_USER;
    if (!token || !user) {
      throw new Error("PUSHOVER_TOKEN and PUSHOVER_USER must be set");
    }
    const body = new URLSearchParams();
    body.set("token", token);
    body.set("user", user);
    body.set("title", args.title);
    body.set("message", args.message);
    if (args.url) body.set("url", args.url);
    if (args.urlTitle) body.set("url_title", args.urlTitle);
    const res = await fetch("https://api.pushover.net/1/messages.json", {
      method: "POST",
      body,
    });
    const data = (await res.json()) as { status?: number };
    if (!res.ok || data.status !== 1) {
      throw new Error(`Pushover API error: ${JSON.stringify(data)}`);
    }
    console.log(`Pushover sent: ${args.title}`);
    return null;
  },
});
