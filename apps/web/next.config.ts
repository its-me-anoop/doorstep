import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // firebase-admin sits on Next's default server-external list, which loads
  // it with native require() at runtime. Its CJS dependency jwks-rsa does
  // require('jose') — ESM-only — which throws ERR_REQUIRE_ESM on lambda
  // runtimes without require(esm) support (observed on Vercel; works on
  // local Node 24). Bundling it instead lets the bundler handle the
  // ESM/CJS interop, removing the runtime dependency on require(esm).
  transpilePackages: ['firebase-admin'],
}

export default nextConfig
