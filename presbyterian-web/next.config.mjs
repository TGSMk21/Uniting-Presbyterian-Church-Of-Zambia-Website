import { dashboardHeaders, securityHeaders } from "./Utilities/securityHeaders.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // No "X-Powered-By: Next.js": it only helps someone looking for known weaknesses.
  poweredByHeader: false,
  experimental: {
    // Dashboard photo uploads. Vercel refuses requests over 4.5 MB whatever this says.
    serverActions: { bodySizeLimit: "4.2mb" },
  },
  // Old addresses still reach the branch finder.
  async redirects() {
    return [
      { source: "/branches", destination: "/find-a-branch", permanent: true },
      { source: "/find-a-church", destination: "/find-a-branch", permanent: true },
      // "Activities" became "events" (owner's request, 2026-11-08).
      { source: "/:branch/projects-and-activities", destination: "/:branch/projects-and-events", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({ dev: process.env.NODE_ENV === "development" }),
      },
      { source: "/dashboard/:path*", headers: dashboardHeaders() },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.youtube.com' },
    ],
  },
};

export default nextConfig;
