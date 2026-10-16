import { defineConfig } from "vitest/config";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL must point to an isolated test database/schema; the working database is never a test default.");
const target = new URL(testUrl);
if (!/test/i.test(target.pathname) && !/^test_/i.test(target.searchParams.get("schema") ?? "")) throw new Error("Use a database containing 'test' or a schema beginning test_.");
process.env.DATABASE_URL = testUrl;

export default defineConfig({ test: { include: ["src/**/*.integration.test.ts"], testTimeout: 30_000, hookTimeout: 30_000, maxWorkers: 1, fileParallelism: false } });

