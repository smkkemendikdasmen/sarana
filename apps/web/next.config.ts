import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(currentDirectory, "../.."),
  },
  async rewrites() {
    const backendInternal = process.env.BACKEND_INTERNAL_BASE_URL ?? "http://127.0.0.1:4000";
    const base = String(backendInternal).replace(/\/$/, "");
    return [
      { source: "/api/v1/:path*", destination: `${base}/v1/:path*` },
      { source: "/api/:path*",    destination: `${base}/v1/:path*` },
      { source: "/v1/:path*",     destination: `${base}/v1/:path*` },
    ];
  },
};

export default nextConfig;
