import { httpRouter } from "convex/server";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { auth } from "./auth";
import { components } from "./_generated/api";
import {
  createPost,
  getPost,
  listPosts,
  setAgentStatus,
  updatePost,
  uploadAsset,
} from "./apiKeys/httpActions";
import { postPage } from "./posts/httpActions";

const http = httpRouter();

auth.addHttpRoutes(http);
http.route({ path: "/api/agent/status", method: "POST", handler: setAgentStatus });
http.route({ path: "/api/posts", method: "GET", handler: listPosts });
http.route({ path: "/api/posts", method: "POST", handler: createPost });
http.route({ pathPrefix: "/api/posts/", method: "GET", handler: getPost });
// Longer prefix than static-hosting's catch-all "/", so post permalinks get
// server-rendered Open Graph tags instead of the plain SPA shell.
http.route({ pathPrefix: "/posts/", method: "GET", handler: postPage });
http.route({ pathPrefix: "/api/posts/", method: "PATCH", handler: updatePost });
http.route({ pathPrefix: "/api/posts/", method: "POST", handler: uploadAsset });
registerStaticRoutes(http, components.staticHosting);

export default http;
