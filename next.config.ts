import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deployed via `npm run build && npm start` on Hostinger's Node.js
  // hosting (full repo checkout, not Docker) — "standalone" output is
  // built for `node .next/standalone/server.js` and warns/misbehaves
  // under plain `next start`, which is what actually runs here.
  experimental: {
    // A hospedagem compartilhada enxerga dezenas de CPUs, mas recusa criar
    // tantos processos: "Collecting page data using 63 workers" abortou o
    // build com "OS can't spawn worker thread" (deploys de 26 e 29/10).
    cpus: 2,
  },
};

export default nextConfig;
