<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Production deploy memory

- Production deploys through Hostinger's native GitHub repository integration. A push to `main` triggers Hostinger's build and release.
- `.github/workflows/ci.yml` runs quality checks; it does not deploy the app. A failed GitHub Actions test run is separate from Hostinger's deployment status.
- A `401 Unauthenticated` from the Hostinger Codex connector means only that the connector cannot inspect hPanel. It does not mean the GitHub push or production deploy failed. For routine deploy verification, check the public app and its current build assets. Use the Hostinger connector only for account details such as build logs or environment variables; if it returns an auth error without opening sign-in, report it and stop instead of switching to SSH as a workaround.
