import path from "node:path";
import dotenv from "dotenv";
import type { NextConfig } from "next";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {
  transpilePackages: ["@rizlife/shared"],
  serverExternalPackages: ["@prisma/client", "prisma", "bcryptjs", "nodemailer", "exceljs"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Lint runs once for the whole monorepo (`npm run lint`, CI), not per app build.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
