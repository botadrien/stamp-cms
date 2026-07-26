// Gère le flow OAuth2 + PKCE complet, sans aucun serveur.

const AUTH_ENDPOINT = () => `${CONFIG.instanceUrl}/login/oauth/authorize`;
const TOKEN_ENDPOINT = () => `${CONFIG.instanceUrl}/login/oauth/access_token`;

const TOKEN_STORAGE_KEY = "cms_poc_access_token";
const VERIFIER_STORAGE_KEY = "cms_poc_code_verifier";
// Fournisseur associé au token stocké ("codeberg" ou "github") — absent sur une session
// existante d'avant le support multi-fournisseur, d'où le défaut "codeberg" dans
// getStoredProviderId() ci-dessous (et dans les tests e2e, qui restent Codeberg/Forgejo).
const PROVIDER_STORAGE_KEY = "cms_poc_provider";

async function startLogin() {
  const { codeVerifier, codeChallenge } = await generatePkcePair();
  // Le code_verifier doit survivre à la redirection complète vers Codeberg puis retour.
  sessionStorage.setItem(VERIFIER_STORAGE_KEY, codeVerifier);

  const params = new URLSearchParams({
    client_id: CONFIG.clientId,
    redirect_uri: CONFIG.redirectUri,
    response_type: "code",
    scope: CONFIG.scope,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  window.location.href = `${AUTH_ENDPOINT()}?${params.toString()}`;
}

async function handleRedirectCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (!code) return null;

  const codeVerifier = sessionStorage.getItem(VERIFIER_STORAGE_KEY);
  if (!codeVerifier) {
    throw new Error("La connexion a expiré ou a été interrompue, réessaie de te connecter.");
  }

  const body = new URLSearchParams({
    client_id: CONFIG.clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: CONFIG.redirectUri,
    code_verifier: codeVerifier,
  });

  let response;
  try {
    response = await fetch(TOKEN_ENDPOINT(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch (networkErr) {
    console.error("Network error lors de l'échange du token :", networkErr);
    throw new Error("Impossible de contacter Codeberg — vérifie ta connexion et réessaie.");
  }

  if (!response.ok) {
    console.error(`Échec de l'échange du token (${response.status}) :`, await response.text());
    throw new Error("La connexion à Codeberg a échoué, réessaie.");
  }

  const data = await response.json();
  sessionStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
  sessionStorage.setItem(PROVIDER_STORAGE_KEY, "codeberg");
  sessionStorage.removeItem(VERIFIER_STORAGE_KEY);

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
