import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:8080",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "python3 scripts/local-server.py 8080",
    cwd: "..",
    url: "http://localhost:8080/config.js",
    reuseExistingServer: true,
    timeout: 10_000,
  },
});
