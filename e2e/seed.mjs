// Provisionne une instance Forgejo locale (lancée via docker-compose.yml) pour les
// tests e2e : un utilisateur, une app OAuth2 publique (PKCE), un dépôt de test.
// Écrit le résultat dans e2e/.seed.json, lu ensuite par les tests Playwright.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMPOSE = ["compose", "-f", path.join(__dirname, "docker-compose.yml")];

const INSTANCE_URL = "http://localhost:3000";
const REDIRECT_URI = "http://localhost:8080/";
const USERNAME = "e2e";
const PASSWORD = "e2e-Test-Passw0rd!";
const EMAIL = "e2e@example.test";
const REPO_NAME = "test-site";

function compose(...args) {
  return execFileSync("docker", [...COMPOSE, ...args], { encoding: "utf-8" });
}

async function waitForForgejo(timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${INSTANCE_URL}/api/healthz`);
      if (res.ok) return;
    } catch {
      // pas encore prêt
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Forgejo n'a pas répondu à temps sur /api/healthz");
}

async function main() {
  console.log("Démarrage de Forgejo (docker compose up -d)…");
  compose("up", "-d");

  console.log("Attente que Forgejo soit prêt…");
  await waitForForgejo();

  console.log(`Création de l'utilisateur ${USERNAME}…`);
  compose(
    "exec",
    "-T",
    "-u",
    "git",
    "forgejo",
    "forgejo",
    "admin",
    "user",
    "create",
    "--username",
    USERNAME,
    "--password",
    PASSWORD,
    "--email",
    EMAIL,
    "--admin",
    "--must-change-password=false"
  );

  console.log("Génération d'un token d'accès…");
  const token = compose(
    "exec",
    "-T",
    "-u",
    "git",
    "forgejo",
    "forgejo",
    "admin",
    "user",
    "generate-access-token",
    "--username",
    USERNAME,
    "--token-name",
    "seed",
    "--scopes",
    "all",
    "--raw"
  ).trim();

  const authHeaders = {
    Authorization: `token ${token}`,
    "Content-Type": "application/json",
  };

  console.log("Création de l'app OAuth2 publique (PKCE, sans secret)…");
  const oauthRes = await fetch(`${INSTANCE_URL}/api/v1/user/applications/oauth2`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      name: "cms-statique-e2e",
      confidential_client: false,
      redirect_uris: [REDIRECT_URI],
    }),
  });
  if (!oauthRes.ok) {
    throw new Error(`Échec création app OAuth2 (${oauthRes.status}) : ${await oauthRes.text()}`);
  }
  const oauthApp = await oauthRes.json();

  console.log(`Création du dépôt de test ${REPO_NAME}…`);
  const repoRes = await fetch(`${INSTANCE_URL}/api/v1/user/repos`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ name: REPO_NAME, auto_init: true, default_branch: "main" }),
  });
  if (!repoRes.ok) {
    throw new Error(`Échec création dépôt (${repoRes.status}) : ${await repoRes.text()}`);
  }

  // Un vrai site créé via le POC (createSite() dans app.js) a toujours une branche
  // "pages" — sans elle, "Publier" (qui republie sur cette branche) échoue.
  console.log("Création de la branche pages...");
  const branchRes = await fetch(`${INSTANCE_URL}/api/v1/repos/${USERNAME}/${REPO_NAME}/branches`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ new_branch_name: "pages", old_branch_name: "main" }),
  });
  if (!branchRes.ok) {
    throw new Error(`Échec création branche pages (${branchRes.status}) : ${await branchRes.text()}`);
  }

  const seed = {
    instanceUrl: INSTANCE_URL,
    redirectUri: REDIRECT_URI,
    username: USERNAME,
    password: PASSWORD,
    token,
    clientId: oauthApp.client_id,
    repoOwner: USERNAME,
    repoName: REPO_NAME,
  };

  writeFileSync(path.join(__dirname, ".seed.json"), JSON.stringify(seed, null, 2));
  console.log("Seed écrit dans e2e/.seed.json ✓");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
