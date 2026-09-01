import type { NextConfig } from "next"

/**
 * The API's origin.
 *
 * Read at **build time**, not at boot: Next serialises the result of `rewrites()` into
 * the routes manifest, so setting this before `next start` has no effect. Changing which
 * API the browser reaches means rebuilding. Server-side code reads the same variable at
 * request time and is not subject to that.
 */
const apiOrigin = process.env.WARP_API_ORIGIN ?? "http://localhost:8080"

const nextConfig: NextConfig = {
  reactCompiler: true,

  /**
   * The browser reaches the API through this app's own origin.
   *
   * The session cookie is `HttpOnly` and `SameSite=Lax`. Calling `:8080` from `:3000`
   * directly would work in development — different ports are same-site — but it needs
   * CORS with credentials, and it stops working the moment the two are deployed on
   * different hosts. Proxying makes every call same-origin, so the cookie is simply
   * sent, and there is no CORS configuration to keep in step with a deployment.
   */
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${apiOrigin}/api/v1/:path*` }]
  },
}

export default nextConfig
