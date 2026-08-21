import { defineConfig } from "@playwright/test";

// Config Playwright séparée de playwright.config.mjs (Forgejo) : testDir dédié
// (specs-gitlab/) pour que ces specs ne soient jamais ramassées par `npm run e2e` par
// défaut — voir README.md, section "Lancer les tests", et npm run e2e:gitlab.
export default defineConfig({
  testDir: "./specs-gitlab",
  timeout: 120_000,
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
    url: "http://localhost:8080/auth/config.js",
    reuseExistingServer: true,
    timeout: 10_000,
  },
});
