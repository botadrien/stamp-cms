// Gère le flow OAuth2 + PKCE complet, sans aucun serveur — générique sur le fournisseur
// (Codeberg, GitLab, ...) : chaque fournisseur OAuth expose sa config (endpoints, clientId,
// scope, redirectUri) via l'entrée `oauth` de providers.js, voir GIT_PROVIDERS.

const TOKEN_STORAGE_KEY = "cms_poc_access_token";
const VERIFIER_STORAGE_KEY = "cms_poc_code_verifier";
// Fournisseur associé au token stocké ("codeberg", "github" ou "gitlab") — absent sur une
// session existante d'avant le support multi-fournisseur, d'où le défaut "codeberg" dans
// getStoredProviderId() ci-dessous (et dans les tests e2e, qui restent Codeberg/Forgejo).
const PROVIDER_STORAGE_KEY = "cms_poc_provider";
// Fournisseur OAuth dont la connexion est en cours (posé juste avant la redirection plein-
// écran, lu au retour par handleRedirectCallback() pour savoir quel `oauth.tokenEndpoint`
// appeler — le paramètre `code` renvoyé dans l'URL ne porte pas cette info lui-même).
const PENDING_PROVIDER_STORAGE_KEY = "cms_poc_pending_oauth_provider";

async function startLogin(providerId) {
  const provider = GIT_PROVIDERS[providerId];
  const { codeVerifier, codeChallenge } = await generatePkcePair();
  // Le code_verifier doit survivre à la redirection complète vers le fournisseur puis retour.
  sessionStorage.setItem(VERIFIER_STORAGE_KEY, codeVerifier);
  sessionStorage.setItem(PENDING_PROVIDER_STORAGE_KEY, providerId);

  const params = new URLSearchParams({
    client_id: provider.oauth.clientId,
    redirect_uri: provider.oauth.redirectUri,
    response_type: "code",
    scope: provider.oauth.scope,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  window.location.href = `${provider.oauth.authEndpoint}?${params.toString()}`;
}

async function handleRedirectCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (!code) return null;

  const providerId = sessionStorage.getItem(PENDING_PROVIDER_STORAGE_KEY);
  const provider = providerId && GIT_PROVIDERS[providerId];
  const codeVerifier = sessionStorage.getItem(VERIFIER_STORAGE_KEY);
  if (!provider || !codeVerifier) {
    throw new Error("La connexion a expiré ou a été interrompue, réessaie de te connecter.");
  }

  const body = new URLSearchParams({
    client_id: provider.oauth.clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: provider.oauth.redirectUri,
    code_verifier: codeVerifier,
  });

  let response;
  try {
    response = await fetch(provider.oauth.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch (networkErr) {
    console.error("Network error lors de l'échange du token :", networkErr);
    throw new Error(`Impossible de contacter ${provider.label} — vérifie ta connexion et réessaie.`);
  }

  if (!response.ok) {
    console.error(`Échec de l'échange du token (${response.status}) :`, await response.text());
    throw new Error(`La connexion à ${provider.label} a échoué, réessaie.`);
  }

  const data = await response.json();
  sessionStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
  sessionStorage.setItem(PROVIDER_STORAGE_KEY, providerId);
  sessionStorage.removeItem(VERIFIER_STORAGE_KEY);
  sessionStorage.removeItem(PENDING_PROVIDER_STORAGE_KEY);

  // Nettoie l'URL (retire ?code=... de la barre d'adresse)
  window.history.replaceState({}, document.title, window.location.pathname);

  return data.access_token;
}

// Connexion par jeton d'accès personnel collé à la main (GitHub) — pas de redirection,
// pas de client_secret : on valide juste le jeton en interrogeant l'utilisateur·rice
// courant·e avant de le stocker, pour ne jamais persister un jeton invalide silencieusement.
async function loginWithToken(providerId, token) {
  const provider = GIT_PROVIDERS[providerId];
  const api = new provider.ApiClass(token);
  await api.getCurrentUser(); // lève une erreur explicite si le jeton est invalide/insuffisant
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  sessionStorage.setItem(PROVIDER_STORAGE_KEY, providerId);
}

function getStoredToken() {
  return sessionStorage.getItem(TOKEN_STORAGE_KEY);
}

function getStoredProviderId() {
  return sessionStorage.getItem(PROVIDER_STORAGE_KEY) || "codeberg";
}

function logout() {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(PROVIDER_STORAGE_KEY);
  window.location.hash = "";
  window.location.reload();
}
