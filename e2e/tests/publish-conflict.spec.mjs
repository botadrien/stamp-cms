// Test e2e réel : vérifie que publier une page modifiée entre-temps par quelqu'un
// d'autre (même sha périmé) affiche un message de conflit clair, plutôt que d'écraser
// silencieusement ce changement ou d'afficher une erreur technique brute.
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

test("publier une page modifiée entre-temps affiche un conflit, pas une erreur brute", async ({ page }) => {
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

  const testPath = "content/conflict-test.md";
  const addPageCard = page.locator(".card", { has: page.locator("#newPageTitle") });
  await addPageCard.locator("#newPageTitle").fill("conflict-test");
  await addPageCard.getByRole("button", { name: "Créer" }).click();

  // Première publication : crée le fichier.
  const editor = page.locator("#editorMount [contenteditable=true]");
  await editor.click();
  await page.keyboard.type("Version initiale");
  await page.getByRole("button", { name: "Publier" }).click();
  await expect(page.locator(".status.success")).toContainText("Publié", { timeout: 10_000 });

  // Quelqu'un d'autre modifie ce même fichier directement via l'API, entre-temps.
  const getRes = await page.request.get(
    `${seed.instanceUrl}/api/v1/repos/${seed.repoOwner}/${seed.repoName}/contents/${testPath}`,
    { headers: { Authorization: `token ${seed.token}` } }
  );
  const current = await getRes.json();
  await page.request.put(
    `${seed.instanceUrl}/api/v1/repos/${seed.repoOwner}/${seed.repoName}/contents/${testPath}`,
    {
      headers: { Authorization: `token ${seed.token}`, "Content-Type": "application/json" },
      data: {
        content: Buffer.from("Modifié par quelqu'un d'autre").toString("base64"),
        message: "Modification concurrente",
        sha: current.sha,
        branch: "main",
      },
    }
  );

  // On republie depuis le POC sans avoir rechargé : le sha local est maintenant périmé.
  await editor.click();
  await page.keyboard.type(" — suite écrite sans recharger");
  await page.getByRole("button", { name: "Publier" }).click();

  await expect(page.locator(".status.error")).toContainText("modifiée entre-temps", { timeout: 10_000 });
  await expect(page.locator(".status.error")).not.toContainText(/\{|API error|status/i);
});
