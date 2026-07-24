// Test e2e réel : crée un nouveau site depuis le POC (pas de mock) et vérifie que la
// branche "pages" a bien été créée avec un fichier index.html, via l'API Forgejo.
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

test("créer un site publie automatiquement une branche pages", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Se connecter avec Codeberg" }).click();

  await page.waitForURL(/\/user\/login/);
  await page.locator("#user_name").fill(seed.username);
  await page.locator("#password").fill(seed.password);
  await page.locator("#password").press("Enter");

  await page.locator("#authorize-app").click();
  await page.waitForURL(/localhost:8080/);
  await expect(page.getByText(`${seed.repoOwner}/${seed.repoName}`)).toBeVisible({ timeout: 10_000 });

  const siteName = `e2e-nouveau-site-${Date.now()}`;
  await page.locator("#newSiteName").fill(siteName);
  await page.getByRole("button", { name: "Créer" }).click();

  // La création enchaîne 4 appels API (repo, branche, webhook, fichier) avant de passer
  // à l'éditeur.
  await expect(page.getByText(`${seed.repoOwner}/${siteName}`)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: /Voir le site publié/ })).toBeVisible();

  // Vérification indépendante côté API : la branche "pages" existe avec un index.html.
  const res = await page.request.get(
    `${seed.instanceUrl}/api/v1/repos/${seed.repoOwner}/${siteName}/contents/index.html?ref=pages`,
    { headers: { Authorization: `token ${seed.token}` } }
  );
  expect(res.ok()).toBeTruthy();
  const file = await res.json();
  const decoded = Buffer.from(file.content, "base64").toString("utf-8");
  expect(decoded).toContain("Site en construction");

  // Sans le webhook "forgejo" filtré sur la branche "pages", Codeberg Pages ne sert
  // jamais le contenu malgré la branche (voir docs.codeberg.org/codeberg-pages/) — on
  // vérifie donc qu'il a bien été créé, pas seulement la branche.
  const hooksRes = await page.request.get(
    `${seed.instanceUrl}/api/v1/repos/${seed.repoOwner}/${siteName}/hooks`,
    { headers: { Authorization: `token ${seed.token}` } }
  );
  expect(hooksRes.ok()).toBeTruthy();
  const hooks = await hooksRes.json();
  expect(hooks).toHaveLength(1);
  expect(hooks[0]).toMatchObject({
    type: "forgejo",
    branch_filter: "pages",
    active: true,
  });
});

test("créer un site avec un nom déjà pris affiche un message clair", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Se connecter avec Codeberg" }).click();

  await page.waitForURL(/\/user\/login/);
  await page.locator("#user_name").fill(seed.username);
  await page.locator("#password").fill(seed.password);
  await page.locator("#password").press("Enter");

  await page.locator("#authorize-app").click();
  await page.waitForURL(/localhost:8080/);
  await expect(page.getByText(`${seed.repoOwner}/${seed.repoName}`)).toBeVisible({ timeout: 10_000 });

  // Le dépôt de test créé par le seed existe déjà sous ce nom.
  await page.locator("#newSiteName").fill(seed.repoName);
  await page.getByRole("button", { name: "Créer" }).click();

  await expect(page.locator("#createSiteStatus .status.error")).toContainText("déjà pris", {
    timeout: 10_000,
  });
  await expect(page.locator("#createSiteStatus .status.error")).not.toContainText(/\{|API error|status/i);
});
