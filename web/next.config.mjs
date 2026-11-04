/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
};

export default nextConfig;
