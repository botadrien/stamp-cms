// Test e2e réel : l'écran d'édition doit montrer un aperçu généré par Zola (via le
// service worker sw.js, voir buildPreviewSite() dans site-builder.js) sans passer par
// "Publier" — couvre le rebuild en direct et la navigation entre pages dans l'aperçu.
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

// Dépôt dédié (voir site-settings-and-split.spec.mjs) : plusieurs specs tournent en
// parallèle et republient/rebuildent tout le site, un dépôt partagé collisionnerait.
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

async function login(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Se connecter avec Codeberg" }).click();
  await page.waitForURL(/\/user\/login/);
  await page.locator("#user_name").fill(seed.username);
  await page.locator("#password").fill(seed.password);
  await page.locator("#password").press("Enter");
  await page.locator("#authorize-app").click();
  await page.waitForURL(/localhost:8080/);
}

test("l'aperçu se génère sans publier et reflète le brouillon en cours", async ({ page }) => {
  const repoName = `live-preview-test-${Date.now()}`;
  await createTestRepo(page, repoName);

  await login(page);
  const repoItem = page.locator(".repo-item", { hasText: `${seed.repoOwner}/${repoName}` });
  await expect(repoItem).toBeVisible({ timeout: 10_000 });
  await repoItem.getByRole("button", { name: "Ouvrir" }).click();

  const addPageCard = page.locator(".card", { has: page.locator("#newPageTitle") });
  await addPageCard.locator("#newPageTitle").fill("aperçu e2e");
  await addPageCard.getByRole("button", { name: "Créer" }).click();

  const text = `Brouillon jamais publié — ${Date.now()}, accents: éàçù.`;
  const editor = page.locator("#editorMount [contenteditable=true]");
  await editor.click();
  await page.keyboard.type(text);

  // Le rebuild d'aperçu est débounced (~1.8s) puis prend ~11-15s (thème complet, voir
  // AGENTS.md) — même budget que les tests de publication existants.
  const previewFrame = page.frameLocator("#previewFrame");
  await expect(previewFrame.locator("body")).toContainText(text, { timeout: 60_000 });

  // Généré par Zola avec le vrai thème/nav — pas juste le texte brut injecté.
  await expect(previewFrame.locator(".main-navigation")).toContainText("Accueil");

  // Rien n'a été publié : le fichier n'existe pas sur main, aucune page HTML sur pages.
  const mainRes = await page.request.get(
    `${seed.instanceUrl}/api/v1/repos/${seed.repoOwner}/${repoName}/contents/content/apercu-e2e.md`,
    { headers: { Authorization: `token ${seed.token}` } }
  );
  expect(mainRes.status()).toBe(404);

  // Navigation à l'intérieur de l'aperçu : cliquer "Accueil" doit resservir une autre
  // page via sw.js, pas un 404 (vérifie le routage /preview/<owner>/<repo>/... du worker
  // au-delà de la seule page éditée).
  await previewFrame.locator(".main-navigation").getByRole("link", { name: "Accueil" }).click();
  await expect(previewFrame.locator("body")).not.toContainText("Aperçu introuvable");
});
