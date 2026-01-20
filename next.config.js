/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    serverExternalPackages: ['sharp', 'onnxruntime-node'],
};

module.exports = nextConfig;
