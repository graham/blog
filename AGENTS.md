<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Deployments

- Deployment selection is local to each checkout in the ignored `.env.local`; never hard-code deployment or team names.
- Ship: `npm run ship:dev`. For prod, `npx convex deploy --yes` then `npx @convex-dev/static-hosting upload --build --prod --spa` (do not use a `convex deploy` that can prompt). `npm run build` has no `prebuild`; do not add `convex dev --once` to it.
- Do not start Vite / `npm run dev` unless asked.

## Image overlay

Click-to-enlarge is `ImageOverlay` / `ZoomableImage`. Multiple images get prev/next buttons, ArrowLeft/ArrowRight, wrap-around, and `n / m`. One image hides the controls.

- Public post: cover first, then body markdown images (cover duplicate dropped).
- Editor gutter: all uploaded assets with URLs.
- Editor preview: markdown body images only.
