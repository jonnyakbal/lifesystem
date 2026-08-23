import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deployed via `npm run build && npm start` on Hostinger's Node.js
  // hosting (full repo checkout, not Docker) — "standalone" output is
  // built for `node .next/standalone/server.js` and warns/misbehaves
  // under plain `next start`, which is what actually runs here.
};

export default nextConfig;