// Test e2e réel : couvre le système de thèmes (app/themes/, voir README "Thèmes") —
// choix du thème à la création, changement depuis Réglages sans écraser un gabarit déjà
// personnalisé, et non-régression du fichier site.toml (une seule clé ne doit jamais en
// effacer une autre, voir getSiteTomlFields()/setSiteTomlField() dans
// app/site/site-builder.js).
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

// Dépôt dédié à chaque test plutôt que seed.repoName — voir le même commentaire dans
// site-settings-and-split.spec.mjs (republication concurrente = collisions d'écriture).
async function createTestRepo(page, repoName) {
  const authHeaders = { Authorization: `token ${seed.token}`, "Content-Type": "application/json" };
  await page.request.post(`${seed.instanceUrl}/api/v1/user/repos`, {
    headers: authHeaders,
    data: { name: repoName, auto_init: true, default_branch: "main" },
  });
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

async function getRepoFile(page, repoName, filePath, ref = "main") {
  return page.request.get(
    `${seed.instanceUrl}/api/v1/repos/${seed.repoOwner}/${repoName}/contents/${filePath}?ref=${ref}`,
    { headers: { Authorization: `token ${seed.token}` } }
  );
}

async function decodeRepoFile(res) {
  const file = await res.json();
  return Buffer.from(file.content, "base64").toString("utf-8");
}

test("créer un site avec le thème devblog applique sa palette et sa police au site publié", async ({ page }) => {
  await login(page);

  const siteName = `e2e-theme-devblog-${Date.now()}`;
  await page.locator("#newSiteName").fill(siteName);
  await page.locator('.theme-picker-card:has(input[value="devblog"])').click();
  await page.getByRole("button", { name: "Créer" }).click();

  await expect(page.getByText(`${seed.repoOwner}/${siteName}`)).toBeVisible({ timeout: 60_000 });

  const tomlRes = await getRepoFile(page, siteName, "site.toml");
  expect(tomlRes.ok()).toBeTruthy();
  expect(await decodeRepoFile(tomlRes)).toContain('theme = "devblog"');

  const homeRes = await getRepoFile(page, siteName, "index.html", "pages");
  expect(homeRes.ok()).toBeTruthy();
  const home = await decodeRepoFile(homeRes);
  expect(home).toContain("--ssg-accent:#ec4899");
  expect(home).toContain("fonts.googleapis.com/css2?family=Space+Grotesk");
});

test("changer de thème republie sans toucher un gabarit déjà personnalisé", async ({ page }) => {
  const repoName = `e2e-theme-switch-${Date.now()}`;
  await createTestRepo(page, repoName);
  await login(page);

  const repoItem = page.locator(".repo-item", { hasText: `${seed.repoOwner}/${repoName}` });
  await expect(repoItem).toBeVisible({ timeout: 10_000 });
  await repoItem.getByRole("button", { name: "Ouvrir" }).click();

  // Personnalise le gabarit "Accueil" : ouvre l'éditeur de mise en page, sélectionne le
  // bloc Footer déjà présent (data-puck-component porte l'id du bloc, voir
  // app/ssg/default-templates.js: footerProps("home-footer")) et édite un champ texte
  // simple plutôt que de glisser-déposer un nouveau bloc (DnD Puck non exercé ailleurs
  // dans la suite e2e, un champ existant suffit à produire un gabarit personnalisé).
  await page.getByRole("link", { name: "Mise en page" }).click();
  await page.getByRole("link", { name: "Accueil" }).click();
  await expect(page.locator('[data-puck-component="home-footer"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-puck-component="home-footer"]').click();
  // Puck rend deux copies du panneau de champs (desktop + mobile, une seule visible à la
  // fois selon le viewport) — on cible celle qui l'est réellement.
  await page.getByLabel("Baseline").last().fill("Personnalisé avant changement de thème");
  await page.waitForTimeout(300); // debounce onChange de Puck avant "Publish"
  // Le bouton "Publish" natif de Puck n'est pas un <button> accessible (role "generic"),
  // pas de getByRole possible ici.
  await page.getByText("Publish", { exact: true }).click();
  await expect(page.locator("#layoutEditorStatus .status.success")).toContainText("Publié", { timeout: 60_000 });

  const homeTemplateBefore = await decodeRepoFile(await getRepoFile(page, repoName, "templates/home.puck.json"));
  expect(homeTemplateBefore).toContain("Personnalisé avant changement de thème");

  // "page" n'a jamais été personnalisé — retombe sur les défauts du thème actif (voir
  // loadLayoutTemplates() dans app/site/site-builder.js), donc pas de fichier sur main.
  const pageTemplateResBefore = await getRepoFile(page, repoName, "templates/page.puck.json");
  expect(pageTemplateResBefore.ok()).toBeFalsy();

  // Change de thème depuis Réglages (le lien de la sidebar reste visible depuis l'éditeur
  // de mise en page, pas besoin de repasser par "← Retour").
  await page.getByRole("link", { name: "Réglages" }).click();
  await expect(page.locator("#siteThemeForm")).toBeVisible({ timeout: 10_000 });
  await page.locator('#siteThemeForm .theme-picker-card:has(input[value="nonprofit"])').click();
  await page.getByRole("button", { name: "Enregistrer et republier" }).click();
  await expect(page.locator("#siteThemeStatus .status.success")).toContainText("Publié", { timeout: 60_000 });

  const tomlAfter = await decodeRepoFile(await getRepoFile(page, repoName, "site.toml"));
  expect(tomlAfter).toContain('theme = "nonprofit"');

  // Le gabarit "home" personnalisé n'a pas bougé sur main...
  const homeTemplateAfter = await decodeRepoFile(await getRepoFile(page, repoName, "templates/home.puck.json"));
  expect(homeTemplateAfter).toBe(homeTemplateBefore);

  // ...mais le site publié reflète bien le nouveau thème sur "page" (jamais personnalisé)
  // — vérifié via la couleur d'accent nonprofit sur la page "à-propos" par défaut : pas de
  // page standalone créée dans ce test, donc on vérifie plutôt l'accueil (qui MELANGE le
  // gabarit personnalisé — Footer avec la baseline tapée plus haut — et les tokens du
  // nouveau thème sur tout le reste, non fixé par un champ).
  const homePublished = await decodeRepoFile(await getRepoFile(page, repoName, "index.html", "pages"));
  expect(homePublished).toContain("Personnalisé avant changement de thème");
  expect(homePublished).toContain("--ssg-accent:#b45309");
});

test("changer de thème préserve le domaine personnalisé déjà enregistré dans site.toml", async ({ page }) => {
  const repoName = `e2e-theme-toml-merge-${Date.now()}`;
  await createTestRepo(page, repoName);
  await login(page);

  const repoItem = page.locator(".repo-item", { hasText: `${seed.repoOwner}/${repoName}` });
  await expect(repoItem).toBeVisible({ timeout: 10_000 });
  await repoItem.getByRole("button", { name: "Ouvrir" }).click();

  // Le domaine ne résout pas dans l'environnement de test — accepte le confirm() de
  // pré-vol DNS (voir saveCustomDomain() dans app/app.js) pour enregistrer quand même.
  page.on("dialog", (dialog) => dialog.accept());

  await page.getByRole("link", { name: "Réglages" }).click();
  const domainCard = page.locator(".card", { has: page.locator("#customDomain") });
  await expect(domainCard.locator("#customDomain")).toBeVisible({ timeout: 10_000 });
  await domainCard.locator("#customDomain").fill("www.exemple-e2e-theme.test");
  await domainCard.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.locator("#customDomainStatus .status.success")).toContainText("Publié", { timeout: 60_000 });

  await expect(page.locator("#siteThemeForm")).toBeVisible({ timeout: 10_000 });
  await page.locator('#siteThemeForm .theme-picker-card:has(input[value="devblog"])').click();
  await page.getByRole("button", { name: "Enregistrer et republier" }).click();
  await expect(page.locator("#siteThemeStatus .status.success")).toContainText("Publié", { timeout: 60_000 });

  const toml = await decodeRepoFile(await getRepoFile(page, repoName, "site.toml"));
  expect(toml).toContain("custom_domain = \"www.exemple-e2e-theme.test\"");
  expect(toml).toContain('theme = "devblog"');
});
