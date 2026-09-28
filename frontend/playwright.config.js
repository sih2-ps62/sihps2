import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e", workers: 1, timeout: 60000,
  use: { baseURL: "http://127.0.0.1:5184", browserName: "chromium", viewport: { width: 1440, height: 1000 }, trace: "retain-on-failure" },
  webServer: [
    { command: "node scripts/e2e-api.mjs", url: "http://127.0.0.1:8001/health", timeout: 60000 },
    { command: "npm run dev:client -- --host 127.0.0.1 --port 5184", url: "http://127.0.0.1:5184", timeout: 60000,
      env: { VITE_API_URL: "http://127.0.0.1:8001/api" } },
  ],
});
