/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/prospects",
        destination: `${process.env.PROSPECT_API_ORIGIN || "http://127.0.0.1:8000"}/api/prospects`,
      },
      {
        source: "/api/prospects/:path*",
        destination: `${process.env.PROSPECT_API_ORIGIN || "http://127.0.0.1:8000"}/api/prospects/:path*`,
      },
    ];
  },
};

export default nextConfig;
