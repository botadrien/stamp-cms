// Test e2e réel : couvre les deux parties du thème volks-typo/split blog qui n'avaient
// pas encore de test — l'écran "Réglages du site" (titre du blog) et le fait qu'une page
// standalone et un article de blog atterrissent bien à des chemins content/ différents.
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

// Dépôt dédié à chaque test (plutôt que seed.repoName) : plusieurs specs tournent en
// parallèle et republient tout le site à chaque "Publier" — partager un dépôt entre
// tests concurrents provoque de vraies collisions d'écriture sur Forgejo (voir aussi
// legacy-content.spec.mjs).
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

test("modifier le titre du blog depuis Réglages du site republie le site", async ({ page }) => {
  const repoName = `site-settings-test-${Date.now()}`;
  await createTestRepo(page, repoName);

  await login(page);
  const repoItem = page.locator(".repo-item", { hasText: `${seed.repoOwner}/${repoName}` });
  await expect(repoItem).toBeVisible({ timeout: 10_000 });
  await repoItem.getByRole("button", { name: "Ouvrir" }).click();

  await page.getByRole("link", { name: "Réglages du site" }).click();

  const newTitle = `Mon blog e2e ${Date.now()}`;
  const titleInput = page.locator("#blogTitle");
  await expect(titleInput).toBeVisible({ timeout: 10_000 });
  await titleInput.fill(newTitle);
  await page.getByRole("button", { name: "Enregistrer" }).click();

  await expect(page.locator("#settingsStatus .status.success")).toContainText("Publié", {
    timeout: 60_000,
  });

  // Vérification indépendante : le titre a vraiment atterri dans le front matter de
  // content/_index.md sur main, via l'API.
  const res = await page.request.get(
    `${seed.instanceUrl}/api/v1/repos/${seed.repoOwner}/${repoName}/contents/content/_index.md`,
    { headers: { Authorization: `token ${seed.token}` } }
  );
  expect(res.ok()).toBeTruthy();
  const file = await res.json();
  const decoded = Buffer.from(file.content, "base64").toString("utf-8");
  expect(decoded).toContain(`title = "${newTitle}"`);
});

test("une page standalone et un article de blog atterrissent à des chemins content/ différents", async ({
  page,
}) => {
  const repoName = `page-post-split-test-${Date.now()}`;
  await createTestRepo(page, repoName);

  await login(page);
  const repoItem = page.locator(".repo-item", { hasText: `${seed.repoOwner}/${repoName}` });
  await expect(repoItem).toBeVisible({ timeout: 10_000 });
  await repoItem.getByRole("button", { name: "Ouvrir" }).click();

  // Page standalone.
  const addPageCard = page.locator(".card", { has: page.locator("#newPageTitle") });
  await addPageCard.locator("#newPageTitle").fill("page standalone e2e");
  await addPageCard.getByRole("button", { name: "Créer" }).click();
  await page.locator("#editorMount [contenteditable=true]").click();
  await page.keyboard.type("Contenu de la page standalone.");
  await page.getByRole("button", { name: "Publier" }).click();
  await expect(page.locator(".status.success")).toContainText("Publié", { timeout: 60_000 });

  // Retour à la liste des pages pour ajouter l'article de blog.
  await page.getByRole("button", { name: "Retour aux pages" }).click();
  const addPostCard = page.locator(".card", { has: page.locator("#newPostTitle") });
  await expect(addPostCard.locator("#newPostTitle")).toBeVisible({ timeout: 10_000 });
  await addPostCard.locator("#newPostTitle").fill("article de blog e2e");
  await addPostCard.getByRole("button", { name: "Créer" }).click();
  await page.locator("#editorMount [contenteditable=true]").click();
  await page.keyboard.type("Contenu de l'article de blog.");
  await page.getByRole("button", { name: "Publier" }).click();
  await expect(page.locator(".status.success")).toContainText("Publié", { timeout: 60_000 });

  // Vérifications indépendantes via l'API : chemins réels sur main.
  const authHeaders = { Authorization: `token ${seed.token}` };
  const pageRes = await page.request.get(
    `${seed.instanceUrl}/api/v1/repos/${seed.repoOwner}/${repoName}/contents/content/page-standalone-e2e.md`,
    { headers: authHeaders }
  );
  expect(pageRes.ok()).toBeTruthy();

  const postRes = await page.request.get(
    `${seed.instanceUrl}/api/v1/repos/${seed.repoOwner}/${repoName}/contents/content/blog/article-de-blog-e2e.md`,
    { headers: authHeaders }
  );
  expect(postRes.ok()).toBeTruthy();

  // Et dans l'écran "pages du site", chacune apparaît sous son propre groupe — vérifié
  // par l'ordre dans le DOM (renderPageGroup rend "Pages" puis "Articles de blog", sans
  // conteneur par groupe, donc pas de sélecteur CSS propre pour "le contenu de ce groupe").
  // Titre affiché déduit du nom de fichier par titleFromPath() (pas de "# titre" tapé
  // dans l'éditeur) : premier mot capitalisé, le reste tel quel.
  await page.getByRole("button", { name: "Retour aux pages" }).click();
  const pagesList = page.locator("#pagesList");
  await expect(pagesList).toContainText("Page standalone e2e", { timeout: 10_000 });
  const html = await pagesList.innerHTML();
  const pagesHeadingIdx = html.indexOf(">Pages<");
  const postsHeadingIdx = html.indexOf(">Articles de blog<");
  const pageItemIdx = html.indexOf("Page standalone e2e");
  const postItemIdx = html.indexOf("Article de blog e2e");
  expect(pagesHeadingIdx).toBeGreaterThanOrEqual(0);
  expect(postsHeadingIdx).toBeGreaterThan(pagesHeadingIdx);
  expect(pageItemIdx).toBeGreaterThan(pagesHeadingIdx);
  expect(pageItemIdx).toBeLessThan(postsHeadingIdx);
  expect(postItemIdx).toBeGreaterThan(postsHeadingIdx);
});
