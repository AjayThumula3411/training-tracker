import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.55.100.46"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
