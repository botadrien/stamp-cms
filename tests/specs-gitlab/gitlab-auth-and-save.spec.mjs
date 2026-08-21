// Test e2e réel : pas de mock. Un vrai navigateur remplit le vrai formulaire de login
// GitLab, autorise une vraie app OAuth2 (PKCE), puis édite et commit un fichier Markdown —
// vérifié ensuite via l'API GitLab elle-même.
//
// Suite volontairement séparée de tests/specs/ (voir playwright.gitlab.config.mjs et
// README.md) : GitLab CE est nettement plus lourd/lent à démarrer que Forgejo, donc pas
// lancée par défaut. Sélecteurs du formulaire de login / écran de consentement GitLab pas
// encore vérifiés contre une vraie instance — à ajuster au premier run réel si besoin (voir
// plan d'implémentation).
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(path.join(__dirname, "..", ".seed-gitlab.json"), "utf-8"));

test.beforeEach(async ({ page }) => {
  // Fait pointer app/auth/config.js vers l'instance GitLab locale plutôt que gitlab.com.
  await page.addInitScript((cfg) => {
    window.__CMS_TEST_CONFIG__ = cfg;
  }, {
    instanceUrl: seed.instanceUrl,
    clientId: "unused-codeberg-slot",
    redirectUri: seed.redirectUri,
    scope: "read:repository write:repository read:user write:user",
    gitlabClientId: seed.clientId,
  });
});

test("login OAuth2+PKCE réel, édition et commit d'un fichier Markdown", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Se connecter avec GitLab" }).click();

  // Vrai formulaire de login GitLab.
  await page.waitForURL(/\/users\/sign_in/);
  await page.locator("#user_login").fill(seed.username);
  await page.locator("#user_password").fill(seed.password);
  await page.locator("#user_password").press("Enter");

  // Écran de consentement OAuth2 — n'apparaît que la première fois pour cette app/cet
  // utilisateur ; on ne bloque pas dessus s'il est absent (ex. reseed sans destruction du
  // consentement précédent).
  const authorizeButton = page.getByRole("button", { name: /authorize/i });
  if (await authorizeButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await authorizeButton.click();
  }

  // Retour sur l'app, authentifié, dépôt de test listé.
  await page.waitForURL(/localhost:8080/);
  const repoItem = page.locator(".repo-item", { hasText: `${seed.repoOwner}/${seed.repoName}` });
  await expect(repoItem).toBeVisible({ timeout: 10_000 });

  await repoItem.getByRole("button", { name: "Ouvrir" }).click();

  const testPath = "content/e2e-test.md";
  const addPageCard = page.locator(".card", { has: page.locator("#newPageTitle") });
  await addPageCard.locator("#newPageTitle").fill("e2e-test");
  await addPageCard.getByRole("button", { name: "Créer" }).click();

  const text = `Écrit automatiquement le ${new Date().toISOString()} — accents: éàçù.`;
  const editor = page.locator("#editorMount [contenteditable=true]");
  await editor.click();
  await page.keyboard.type(text);
  await page.getByRole("button", { name: "Publier" }).click();

  await expect(page.locator(".status.success")).toContainText("Publié", { timeout: 60_000 });

  // Vérification indépendante : le Markdown source a vraiment atterri sur main, via l'API.
  const projectId = encodeURIComponent(`${seed.repoOwner}/${seed.repoName}`);
  const res = await page.request.get(
    `${seed.instanceUrl}/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(testPath)}?ref=main`,
    { headers: { Authorization: `Bearer ${seed.token}` } }
  );
  expect(res.ok()).toBeTruthy();
  const file = await res.json();
  const decoded = Buffer.from(file.content, "base64").toString("utf-8");
  expect(decoded).toContain(text);

  // Vérification que "Publier" a vraiment régénéré le site avec Zola (pas juste écrit le
  // Markdown) : la page HTML publiée sur la branche pages contient le texte, avec la mise
  // en page/nav réelles générées par Zola — pas un fichier isolé.
  const pageRes = await page.request.get(
    `${seed.instanceUrl}/api/v4/projects/${projectId}/repository/files/${encodeURIComponent("e2e-test/index.html")}?ref=pages`,
    { headers: { Authorization: `Bearer ${seed.token}` } }
  );
  expect(pageRes.ok()).toBeTruthy();
  const pageFile = await pageRes.json();
  const html = Buffer.from(pageFile.content, "base64").toString("utf-8");
  expect(html).toContain(text);
  expect(html).toContain('class="main-navigation"');
  expect(html).toContain(">Accueil<");
});
