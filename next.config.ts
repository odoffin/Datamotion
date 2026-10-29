import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content-Security-Policy: our own origin only, plus exactly what the app needs.
 * Loosened, and why:
 *  - script-src 'unsafe-inline': Next.js App Router streams its bootstrap and
 *    page data as inline <script> tags. The alternative (nonces) forces every
 *    page to render dynamically and is incompatible with the static shells this
 *    app uses (Next docs: "Without Nonces").
 *  - script-src 'wasm-unsafe-eval': lets the DuckDB engine compile and run
 *    WebAssembly. It does not allow JavaScript eval().
 *  - script-src 'unsafe-eval': development only (React's debugging); never in production.
 *  - style-src 'unsafe-inline': next/font and CodeMirror inject <style> tags,
 *    and React sets style attributes.
 *  - img-src data: blob:: small inline images (icons, fonts metadata).
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
  // The DuckDB workers are same-origin files under /duckdb.
  "worker-src 'self'",
  // The workers fetch the engine and the json extension from our own origin.
  // TODO(auth): add the Supabase project origin here when the app starts calling Supabase.
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), bluetooth=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // The DuckDB engine and extensions live under a versioned path
        // (scripts/copy-duckdb-assets.mjs), so they never change in place.
        source: "/duckdb/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
