import { dashboardHeaders, securityHeaders } from "./Utilities/securityHeaders.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  experimental: {
    // Dashboard photo uploads. Vercel refuses requests over 4.5 MB whatever this says.
    serverActions: { bodySizeLimit: "4.2mb" },
  },
  // Old addresses still reach the branch finder.
  async redirects() {
    return [
      { source: "/branches", destination: "/find-a-branch", permanent: true },
      { source: "/find-a-church", destination: "/find-a-branch", permanent: true },
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
