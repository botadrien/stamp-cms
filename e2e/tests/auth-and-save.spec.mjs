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
    scope: "read:repository write:repository read:user",
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
  await expect(page.getByText(`${seed.repoOwner}/${seed.repoName}`)).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Ouvrir" }).click();

  const testPath = "content/e2e-test.md";
  await page.locator("#path").fill(testPath);
  await page.getByRole("button", { name: "Charger ce fichier" }).click();

  // loadFile() ré-écrit tout #app (donc recrée #content) une fois la requête résolue —
  // il faut attendre ce re-render avant de remplir le champ, sous peine d'éditer un
  // <textarea> qui va être remplacé et perdre son contenu.
  await expect(page.locator("#editorStatus")).toContainText(/introuvable|chargé/, {
    timeout: 10_000,
  });

  const content = `# Test e2e\n\nÉcrit automatiquement le ${new Date().toISOString()} — accents: éàçù.`;
  await page.locator("#content").fill(content);
  await page.getByRole("button", { name: "Enregistrer (commit)" }).click();

  await expect(page.locator(".status.success")).toContainText("Commit effectué", { timeout: 10_000 });

  // Vérification indépendante : le commit a vraiment atterri sur Forgejo, via son API.
  const res = await page.request.get(
    `${seed.instanceUrl}/api/v1/repos/${seed.repoOwner}/${seed.repoName}/contents/${testPath}`,
    { headers: { Authorization: `token ${seed.token}` } }
  );
  expect(res.ok()).toBeTruthy();
  const file = await res.json();
  const decoded = Buffer.from(file.content, "base64").toString("utf-8");
  expect(decoded).toBe(content);
});
