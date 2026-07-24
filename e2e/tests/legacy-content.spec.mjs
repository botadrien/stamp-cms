// Test e2e réel : un fichier content/*.md existant sans front matter (créé avant que ça
// soit automatique, ou modifié hors du POC) ne doit pas faire échouer la republication de
// tout le site quand on publie une AUTRE page.
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

test("une page existante sans front matter n'empêche pas de publier une autre page", async ({ page }) => {
  // Dépôt dédié à ce test (plutôt que de réutiliser seed.repoName) : plusieurs specs
  // tournent en parallèle et republient tout le site à chaque "Publier" — partager un
  // dépôt entre tests concurrents provoque de vraies collisions d'écriture sur Forgejo.
  const repoName = `legacy-content-test-${Date.now()}`;
  const authHeaders = { Authorization: `token ${seed.token}`, "Content-Type": "application/json" };
  await page.request.post(`${seed.instanceUrl}/api/v1/user/repos`, {
    headers: authHeaders,
    data: { name: repoName, auto_init: true, default_branch: "main" },
  });
  await page.request.post(`${seed.instanceUrl}/api/v1/repos/${seed.repoOwner}/${repoName}/branches`, {
    headers: authHeaders,
    data: { new_branch_name: "pages", old_branch_name: "main" },
  });

  // Fichier "à l'ancienne" créé directement via l'API, sans front matter — comme s'il
  // avait été écrit avant l'ajout automatique du front matter.
  await page.request.post(
    `${seed.instanceUrl}/api/v1/repos/${seed.repoOwner}/${repoName}/contents/content/legacy.md`,
    {
      headers: authHeaders,
      data: { content: Buffer.from("Contenu sans front matter.").toString("base64"), message: "legacy", branch: "main" },
    }
  );

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

  await page.locator("#path").fill("content/legacy-content-test.md");
  await page.getByRole("button", { name: "Charger ce fichier" }).click();
  await expect(page.locator("#editorStatus")).toContainText(/introuvable|chargé/, { timeout: 10_000 });

  const editor = page.locator("#editorMount [contenteditable=true]");
  await editor.click();
  await page.keyboard.type("Nouvelle page malgré le fichier legacy.");
  await page.getByRole("button", { name: "Publier" }).click();

  await expect(page.locator(".status.success")).toContainText("Publié", { timeout: 10_000 });
});
