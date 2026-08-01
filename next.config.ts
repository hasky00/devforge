import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Avoid picking a parent monorepo lockfile as the Turbopack root
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
