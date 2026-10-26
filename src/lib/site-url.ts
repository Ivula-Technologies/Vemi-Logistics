const INTERNAL_HOST = /^(0\.0\.0\.0|127\.0\.0\.1|localhost|\[::1?\])(:\d+)?$/i;

/**
 * Public origin for absolute redirects. Behind cPanel/Passenger the request URL carries the
 * internal bind address (e.g. http://0.0.0.0:3000), so use the host the browser asked for,
 * then the configured site URL, and only fall back to the raw request origin in local development.
 */
export function publicOrigin(request: Request) {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host"))?.split(",")[0].trim();
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (host && !INTERNAL_HOST.test(host)) {
    // Next.js fills x-forwarded-proto from its own plain-HTTP socket behind the proxy, so it can't be trusted;
    // public hosts are served over HTTPS (cPanel AutoSSL).
    if (configured && new URL(configured).host === host) return configured;
    return `https://${host}`;
  }
  if (configured) return configured;
  return new URL(request.url).origin;
}

export function publicUrl(path: string, request: Request) {
  return new URL(path, `${publicOrigin(request)}/`);
}
