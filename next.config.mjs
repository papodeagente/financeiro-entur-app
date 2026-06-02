/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [{ protocol: "https", hostname: "entur.ia.br" }],
  },
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
};
export default nextConfig;
