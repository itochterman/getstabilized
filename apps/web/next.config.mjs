import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The whole repo shares one .env at the root.
const rootEnv = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@getstabilized/core", "@getstabilized/db"],
  serverExternalPackages: ["pg"],
  poweredByHeader: false,
};

export default nextConfig;
