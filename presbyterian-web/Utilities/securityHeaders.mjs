// Headers sent with every page; next.config.mjs applies them.

export function contentSecurityPolicy({ dev }) {
  const directives = {
    "default-src": ["'self'"],
    // Next.js puts inline scripts in every page. Allowing only those by nonce
    // would force every page to render per request and lose page caching.
    // Analytics loads from this site in production and from Vercel's host in dev.
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(dev ? ["'unsafe-eval'", "https://va.vercel-scripts.com"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    // Any https image: map tiles, YouTube thumbnails, and uploads, which may
    // move to a custom domain. Images can't run code.
    "img-src": ["'self'", "data:", "blob:", "https:", ...(dev ? ["http://localhost:*"] : [])],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...(dev ? ["ws://localhost:*"] : [])],
    "frame-src": ["https://www.youtube.com"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(" ")}`)
    .join("; ");
}

// Staff pages hold one person's data: never index them or store them in a shared cache.
export function dashboardHeaders() {
  return [
    { key: "X-Robots-Tag", value: "noindex, nofollow" },
    { key: "Cache-Control", value: "private, no-store" },
  ];
}

export function securityHeaders({ dev }) {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy({ dev }) },
    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    // YouTube embeds fail without the site's origin, so don't tighten this.
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Find a Branch asks for the visitor's location.
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  ];
}
