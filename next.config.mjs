/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["mongoose", "bullmq", "ioredis"],
  },
};

export default nextConfig;
