import type { NextConfig } from "next"

/**
 * The API's origin. Server-side code talks to it directly; the browser does not —
 * see the rewrite below.
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
