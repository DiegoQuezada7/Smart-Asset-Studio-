import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['sharp', 'onnxruntime-node'],
};

export default nextConfig;
