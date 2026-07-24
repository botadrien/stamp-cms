// Test e2e réel : le bouton "Précédent" du navigateur doit naviguer entre les écrans de
// l'appli (éditeur -> pages du site -> tableau de bord), pas atterrir sur les pages du
// flow OAuth Codeberg (login/consentement) qui précèdent le premier chargement de
// l'appli — ça n'arrivait pas avant que les changements d'écran ne pousse une entrée
// d'historique (window.location.hash), voir app.js.
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

test("le bouton Précédent navigue dans l'appli plutôt que vers le flow OAuth", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Se connecter avec Codeberg" }).click();
  await page.waitForURL(/\/user\/login/);
  await page.locator("#user_name").fill(seed.username);
  await page.locator("#password").fill(seed.password);
  await page.locator("#password").press("Enter");
  await page.locator("#authorize-app").click();
  await page.waitForURL(/localhost:8080/);

  const repoItem = page.locator(".repo-item", { hasText: `${seed.repoOwner}/${seed.repoName}` });
  await expect(repoItem).toBeVisible({ timeout: 10_000 });
  await repoItem.getByRole("button", { name: "Ouvrir" }).click();

  // Écran "pages du site"
  await expect(page.locator("#newPageTitle")).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(new RegExp(`#/${seed.repoOwner}/${seed.repoName}$`));

  // Écran éditeur (page tout juste ajoutée, pas encore publiée)
  await page.locator("#newPageTitle").fill(`nav-test-${Date.now()}`);
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.locator("#editorMount [contenteditable=true]")).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(new RegExp(`#/${seed.repoOwner}/${seed.repoName}/edit/`));

  // Précédent -> revient à la liste des pages du même site, pas au formulaire de login
  // Codeberg ni à aucune autre page du flow OAuth.
  await page.goBack();
  await expect(page.locator("#newPageTitle")).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(new RegExp(`#/${seed.repoOwner}/${seed.repoName}$`));

  // Précédent -> revient au tableau de bord.
  await page.goBack();
  await expect(page.getByText("Tes sites")).toBeVisible({ timeout: 10_000 });

  // Suivant -> ré-avance dans l'appli (pas de "trou" dans l'historique interne).
  await page.goForward();
  await expect(page.locator("#newPageTitle")).toBeVisible({ timeout: 10_000 });
});
