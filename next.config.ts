import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["google-auth-library", "googleapis"],
};

export default nextConfig;