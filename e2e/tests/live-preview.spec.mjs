// Test e2e réel : l'écran d'édition doit montrer un aperçu généré par Zola (via le
// service worker sw.js, voir buildPreviewSite() dans site-builder.js) sans passer par
// "Publier" — couvre le rebuild en direct et la navigation entre pages dans l'aperçu.
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

// Dépôt dédié (voir site-settings-and-split.spec.mjs) : plusieurs specs tournent en
// parallèle et republient/rebuildent tout le site, un dépôt partagé collisionnerait.
async function createTestRepo(page, repoName) {
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
  await typeInRichTextEditor(page, text);

  // Le rebuild d'aperçu est débounced (~1.8s) puis quasi instantané (thème vendoré en CSS
  // précompilé, plus de Sass à recompiler à chaque build) — marge large quand même, ce
  // budget est partagé avec le login + la création de page qui précèdent.
  const previewFrame = page.frameLocator("#previewFrame");
  await expect(previewFrame.locator("body")).toContainText(text, { timeout: 60_000 });

  // Généré par le renderer Puck avec la vraie nav (ssg-src/components/nav.jsx) — pas
  // juste le texte brut injecté. Une seule nav, toujours visible (pas de tiroir mobile
  // dans la palette actuelle).
  await expect(previewFrame.getByRole("navigation")).toContainText("Accueil");

  // Rien n'a été publié : le fichier n'existe pas sur main, aucune page HTML sur pages.
  const mainRes = await page.request.get(
    `${seed.instanceUrl}/api/v1/repos/${seed.repoOwner}/${repoName}/contents/content/apercu-e2e.puck.json`,
    { headers: { Authorization: `token ${seed.token}` } }
  );
  expect(mainRes.status()).toBe(404);

  // Navigation à l'intérieur de l'aperçu : cliquer "Accueil" doit resservir une autre
  // page via sw.js, pas un 404 (vérifie le routage /preview/<owner>/<repo>/... au-delà de
  // la seule page éditée).
  await previewFrame.getByRole("navigation").getByRole("link", { name: "Accueil" }).click();
  await expect(previewFrame.locator("body")).not.toContainText("Aperçu introuvable");
});
