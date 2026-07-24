// Test e2e réel : pas de mock. Un vrai navigateur remplit le vrai formulaire de login
// Forgejo, autorise une vraie app OAuth2 (PKCE), puis édite et commit un fichier
// Markdown — vérifié ensuite via l'API Forgejo elle-même.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(path.join(__dirname, "..", ".seed.json"), "utf-8"));

test.beforeEach(async ({ page }) => {
  // Fait pointer config.js vers l'instance Forgejo locale plutôt que Codeberg (voir CONFIG dans config.js).
  await page.addInitScript((cfg) => {
    window.__CMS_TEST_CONFIG__ = cfg;
  }, {
    instanceUrl: seed.instanceUrl,
    clientId: seed.clientId,
    redirectUri: seed.redirectUri,
    scope: "read:repository write:repository read:user write:user",
  });
});

test("login OAuth2+PKCE réel, édition et commit d'un fichier Markdown", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Se connecter avec Codeberg" }).click();

  // Vrai formulaire de login Forgejo (champs user_name/password confirmés dans le template signin_inner.tmpl).
  await page.waitForURL(/\/user\/login/);
  await page.locator("#user_name").fill(seed.username);
  await page.locator("#password").fill(seed.password);
  await page.locator("#password").press("Enter");

  // Écran de consentement OAuth2 — reste sur l'URL /login/oauth/authorize, seul le
  // formulaire POST vers /login/oauth/grant (bouton #authorize-app, confirmé dans grant.tmpl).
  await page.locator("#authorize-app").click();

  // Retour sur l'app, authentifié, dépôt de test listé.
  await page.waitForURL(/localhost:8080/);
  const repoItem = page.locator(".repo-item", { hasText: `${seed.repoOwner}/${seed.repoName}` });
  await expect(repoItem).toBeVisible({ timeout: 10_000 });

  await repoItem.getByRole("button", { name: "Ouvrir" }).click();

  const testPath = "content/e2e-test.md";
  await page.locator("#path").fill(testPath);
  await page.getByRole("button", { name: "Charger ce fichier" }).click();

  // loadFile() ré-écrit tout #app (donc remonte l'éditeur riche) une fois la requête
  // résolue — il faut attendre ce re-render avant d'écrire dedans.
  await expect(page.locator("#editorStatus")).toContainText(/introuvable|chargé/, {
    timeout: 10_000,
  });

  const text = `Écrit automatiquement le ${new Date().toISOString()} — accents: éàçù.`;
  const editor = page.locator("#editorMount [contenteditable=true]");
  await editor.click();
  await page.keyboard.type(text);
  await page.getByRole("button", { name: "Publier" }).click();

  await expect(page.locator(".status.success")).toContainText("Publié", { timeout: 10_000 });

  // Vérification indépendante : la publication a vraiment atterri sur Forgejo, via son API.
  const res = await page.request.get(
    `${seed.instanceUrl}/api/v1/repos/${seed.repoOwner}/${seed.repoName}/contents/${testPath}`,
    { headers: { Authorization: `token ${seed.token}` } }
  );
  expect(res.ok()).toBeTruthy();
  const file = await res.json();
  const decoded = Buffer.from(file.content, "base64").toString("utf-8");
  expect(decoded).toContain(text);
});
