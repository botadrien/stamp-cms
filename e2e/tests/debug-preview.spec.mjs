import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(path.join(__dirname, "..", ".seed.json"), "utf-8"));

test.beforeEach(async ({ page }) => {
  await page.addInitScript((cfg) => {
    window.__CMS_TEST_CONFIG__ = cfg;
  }, {
    instanceUrl: seed.instanceUrl,
    clientId: seed.clientId,
    redirectUri: seed.redirectUri,
    scope: "read:repository write:repository read:user write:user",
  });
});

async function createTestRepo(page, repoName) {
  const authHeaders = { Authorization: `token ${seed.token}`, "Content-Type": "application/json" };
  await page.request.post(`${seed.instanceUrl}/api/v1/user/repos`, {
    headers: authHeaders,
    data: { name: repoName, auto_init: true, default_branch: "main" },
  });
  await page.request.post(`${seed.instanceUrl}/api/v1/repos/${seed.repoOwner}/${repoName}/branches`, {
    headers: authHeaders,
    data: { new_branch_name: "pages", old_branch_name: "main" },
  });
}

test("debug preview", async ({ page }) => {
  page.on("console", (msg) => console.log("PAGE LOG:", msg.type(), msg.text()));
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("requestfailed", (req) => console.log("REQ FAILED:", req.url(), req.failure()?.errorText));
  page.on("response", (res) => {
    if (res.url().includes("preview")) console.log("RESPONSE:", res.status(), res.url());
  });

  const repoName = `debug-preview-test-${Date.now()}`;
  await createTestRepo(page, repoName);

  await page.goto("/");
  await page.getByRole("button", { name: "Se connecter avec Codeberg" }).click();
  await page.waitForURL(/\/user\/login/);
  await page.locator("#user_name").fill(seed.username);
  await page.locator("#password").fill(seed.password);
  await page.locator("#password").press("Enter");
  await page.locator("#authorize-app").click();
  await page.waitForURL(/localhost:8080/);

  const repoItem = page.locator(".repo-item", { hasText: `${seed.repoOwner}/${repoName}` });
  await expect(repoItem).toBeVisible({ timeout: 10_000 });
  await repoItem.getByRole("button", { name: "Ouvrir" }).click();

  const addPageCard = page.locator(".card", { has: page.locator("#newPageTitle") });
  await addPageCard.locator("#newPageTitle").fill("debug page");
  await addPageCard.getByRole("button", { name: "Créer" }).click();

  await page.waitForTimeout(20_000);

  const src = await page.locator("#previewFrame").getAttribute("src");
  console.log("IFRAME SRC:", src);

  const swState = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return {
      hasReg: !!reg,
      active: reg && reg.active ? reg.active.state : null,
      scope: reg && reg.scope,
      controller: !!navigator.serviceWorker.controller,
    };
  });
  console.log("SW STATE:", JSON.stringify(swState));

  await page.waitForTimeout(5000);
});
