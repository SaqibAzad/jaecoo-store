import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * There is a stray package-lock.json in the home directory above this repo,
   * which makes Turbopack guess the wrong workspace root and warn on every
   * build. Pin it to this project.
   */
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
