// Test e2e réel : un fichier content/*.puck.json existant mais illisible (JSON invalide,
// écrit hors du CMS ou corrompu) ne doit pas faire échouer la republication de tout le
// site quand on publie une AUTRE page.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { typeInRichTextEditor } from "../editor-helpers.mjs";

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
  // renderDashboard() (app.js) ne liste que les dépôts portant ce topic (voir SITE_TOPIC, api.js).
  await page.request.put(`${seed.instanceUrl}/api/v1/repos/${seed.repoOwner}/${repoName}/topics`, {
    headers: authHeaders,
    data: { topics: ["stamp-cms"] },
  });
  await page.request.post(`${seed.instanceUrl}/api/v1/repos/${seed.repoOwner}/${repoName}/branches`, {
    headers: authHeaders,
    data: { new_branch_name: "pages", old_branch_name: "main" },
  });

  // Fichier illisible créé directement via l'API — JSON invalide, comme un fichier
  // corrompu ou modifié hors du CMS.
  await page.request.post(
    `${seed.instanceUrl}/api/v1/repos/${seed.repoOwner}/${repoName}/contents/content/legacy.puck.json`,
    {
      headers: authHeaders,
      data: { content: Buffer.from("pas du JSON valide").toString("base64"), message: "legacy", branch: "main" },
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

  const addPageCard = page.locator(".card", { has: page.locator("#newPageTitle") });
  await addPageCard.locator("#newPageTitle").fill("legacy-content-test");
  await addPageCard.getByRole("button", { name: "Créer" }).click();

  await typeInRichTextEditor(page, "Nouvelle page malgré le fichier legacy.");
  await page.getByRole("button", { name: "Publier" }).first().click();

  await expect(page.locator(".status.success")).toContainText("Publié", { timeout: 60_000 });
});
