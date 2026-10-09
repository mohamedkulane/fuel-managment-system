import { defineConfig } from "vitest/config";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://fuel:fuel@localhost:5436/fuel_wholesale?schema=public";
}

export default defineConfig({ test: { include: ["src/**/*.integration.test.ts"], testTimeout: 30_000, hookTimeout: 30_000, maxWorkers: 1 } });

