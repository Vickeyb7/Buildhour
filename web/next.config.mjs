/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
  outputFileTracingIncludes: {
    "/api/ask": [
      "./node_modules/onnxruntime-node/**/*",
      "./node_modules/@huggingface/transformers/**/*",
    ],
  },
};

export default nextConfig;
