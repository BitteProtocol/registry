import type { NextConfig } from "next";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaPlugin } = require('@prisma/nextjs-monorepo-workaround-plugin')

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'arweave.net',
        port: '',
        pathname: '/**',
      },
    ],
  },
  outputFileTracingRoot: __dirname,
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.plugins.push(new PrismaPlugin());
    }
    return config;
  },
};

export default nextConfig;
