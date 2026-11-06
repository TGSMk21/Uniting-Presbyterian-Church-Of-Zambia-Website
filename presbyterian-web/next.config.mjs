/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // Old addresses still reach the branch finder.
  async redirects() {
    return [
      { source: "/branches", destination: "/find-a-branch", permanent: true },
      { source: "/find-a-church", destination: "/find-a-branch", permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.youtube.com' },
    ],
  },
};

export default nextConfig;
