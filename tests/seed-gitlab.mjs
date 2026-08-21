// Provisionne une instance GitLab CE locale (lancée via docker-compose.gitlab.yml) pour
// les tests e2e GitLab : un utilisateur, une application OAuth2 publique (PKCE), un projet
// de test, une branche "pages". Écrit le résultat dans tests/.seed-gitlab.json, lu ensuite
// par les tests Playwright de tests/specs-gitlab/.
//
// Contrairement à seed.mjs (Forgejo), GitLab n'expose pas d'API REST pour créer une
// application OAuth2 arbitraire ni de CLI dédiée simple pour un premier utilisateur+jeton
// à la volée — on passe donc par `gitlab-rails runner` (console Rails scriptée) pour ces
// deux étapes, avant de basculer sur l'API REST v4 comme le reste du script. Ce script n'a
// pas encore été validé contre une vraie instance (voir plan d'implémentation, e2e GitLab
// volontairement manuel/à la demande) — à ajuster si la version de GitLab CE utilisée
// diverge du comportement supposé ici (ex. validations obligatoires à la création d'un
// utilisateur qui varient d'une version à l'autre).
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMPOSE = ["compose", "-f", path.join(__dirname, "docker-compose.gitlab.yml")];

const INSTANCE_URL = "http://localhost:3000";
const REDIRECT_URI = "http://localhost:8080/";
const USERNAME = "e2e";
const PASSWORD = "e2e-Test-Passw0rd!";
const EMAIL = "e2e@example.test";
const REPO_NAME = "test-site";
const SEED_TOKEN = "e2e-seed-token-1234567890abcdef";

function compose(...args) {
  return execFileSync("docker", [...COMPOSE, ...args], { encoding: "utf-8" });
}

// GitLab CE met plusieurs minutes à démarrer (contrairement à ~1 min pour Forgejo) — d'où
// un timeout nettement plus long ici.
async function waitForGitLab(timeoutMs = 6 * 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${INSTANCE_URL}/-/readiness`);
      if (res.ok) return;
    } catch {
      // pas encore prêt
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("GitLab n'a pas répondu à temps sur /-/readiness");
}

// Script Rails exécuté dans le conteneur : crée (ou recrée) l'utilisateur de test, un
// jeton d'accès personnel à valeur connue, et l'application OAuth2 publique (PKCE, scope
// "api", pas de secret) utilisée par le flow de connexion de l'app.
const RAILS_SCRIPT = `
user = User.find_by_username('${USERNAME}')
user&.destroy

user = User.new(
  username: '${USERNAME}',
  email: '${EMAIL}',
  name: '${USERNAME}',
  password: '${PASSWORD}',
  password_confirmation: '${PASSWORD}'
)
user.skip_confirmation!
user.save!

token = user.personal_access_tokens.create!(scopes: [:api], name: 'seed', expires_at: 365.days.from_now)
token.set_token('${SEED_TOKEN}')
token.save!

app = Doorkeeper::Application.find_by(name: 'cms-statique-e2e')
app&.destroy
app = Doorkeeper::Application.create!(
  name: 'cms-statique-e2e',
  redirect_uri: '${REDIRECT_URI}',
  scopes: 'api',
  confidential: false
)

puts "SEED_CLIENT_ID=#{app.uid}"
`.trim();

async function main() {
  console.log("Démarrage de GitLab CE (docker compose up -d)…");
  compose("up", "-d");

  console.log("Attente que GitLab soit prêt (plusieurs minutes)…");
  await waitForGitLab();

  console.log(`Création de l'utilisateur ${USERNAME}, du jeton et de l'app OAuth2 (gitlab-rails runner)…`);
  const railsOutput = compose("exec", "-T", "gitlab", "gitlab-rails", "runner", RAILS_SCRIPT);
  const clientIdMatch = railsOutput.match(/SEED_CLIENT_ID=(\S+)/);
  if (!clientIdMatch) {
    throw new Error(`Client ID introuvable dans la sortie de gitlab-rails runner :\n${railsOutput}`);
  }
  const clientId = clientIdMatch[1];

  const authHeaders = {
    Authorization: `Bearer ${SEED_TOKEN}`,
    "Content-Type": "application/json",
  };

  console.log(`Création du projet de test ${REPO_NAME}…`);
  const repoRes = await fetch(`${INSTANCE_URL}/api/v4/projects`, {
    method: "POST",
    headers: authHeaders,
    // renderDashboard() (app/app.js) ne liste que les dépôts portant ce topic (voir SITE_TOPIC, app/providers/api.js).
    body: JSON.stringify({ name: REPO_NAME, initialize_with_readme: true, visibility: "public", topics: ["stamp-cms"] }),
  });
  if (!repoRes.ok) {
    throw new Error(`Échec création projet (${repoRes.status}) : ${await repoRes.text()}`);
  }
  const repo = await repoRes.json();

  // Un vrai site créé via le POC (createSite() dans app/app.js) a toujours une branche
  // "pages" — sans elle, "Publier" (qui republie sur cette branche) échoue.
  console.log("Création de la branche pages...");
  const branchParams = new URLSearchParams({ branch: "pages", ref: repo.default_branch });
  const branchRes = await fetch(
    `${INSTANCE_URL}/api/v4/projects/${repo.id}/repository/branches?${branchParams}`,
    { method: "POST", headers: authHeaders }
  );
  if (!branchRes.ok) {
    throw new Error(`Échec création branche pages (${branchRes.status}) : ${await branchRes.text()}`);
  }

  const seed = {
    instanceUrl: INSTANCE_URL,
    redirectUri: REDIRECT_URI,
    username: USERNAME,
    password: PASSWORD,
    token: SEED_TOKEN,
    clientId,
    repoOwner: USERNAME,
    repoName: REPO_NAME,
  };

  writeFileSync(path.join(__dirname, ".seed-gitlab.json"), JSON.stringify(seed, null, 2));
  console.log("Seed écrit dans tests/.seed-gitlab.json ✓");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
