import { httpRouter } from "convex/server";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { auth } from "./auth";
import { components } from "./_generated/api";
import {
  createPost,
  getPost,
  listPosts,
  updatePost,
  uploadAsset,
} from "./apiKeys/httpActions";

const http = httpRouter();

auth.addHttpRoutes(http);
http.route({ path: "/api/posts", method: "GET", handler: listPosts });
http.route({ path: "/api/posts", method: "POST", handler: createPost });
http.route({ pathPrefix: "/api/posts/", method: "GET", handler: getPost });
http.route({ pathPrefix: "/api/posts/", method: "PATCH", handler: updatePost });
http.route({ pathPrefix: "/api/posts/", method: "POST", handler: uploadAsset });
registerStaticRoutes(http, components.staticHosting);

export default http;
