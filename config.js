// Configuration du POC — à adapter avant de déployer.
//
// Codeberg :
// 1. Va sur https://codeberg.org/user/settings/applications
// 2. Crée une nouvelle application OAuth2 :
//      - Nom : ce que tu veux (ex. "CMS Statique POC")
//      - Redirect URI : l'URL exacte où tu déploies ce POC (ex. https://tonuser.codeberg.page/cms-poc/)
//      - IMPORTANT : décoche "Confidential Client" pour forcer PKCE (pas de secret nécessaire)
// 3. Copie le "Client ID" généré ci-dessous.
//
// GitLab (gitlab.com uniquement, pas de self-hosted — voir README) :
// 1. Va sur https://gitlab.com/-/user_settings/applications
// 2. Crée une nouvelle application :
//      - Redirect URI : la même URL que pour Codeberg ci-dessus
//      - Scopes : coche uniquement "api"
//      - IMPORTANT : décoche "Confidential" pour forcer PKCE (pas de secret nécessaire)
// 3. Copie l'"Application ID" généré dans gitlabClientId ci-dessous.

// Les tests e2e (voir e2e/) injectent window.__CMS_TEST_CONFIG__ avant ce script pour
// pointer vers l'instance Forgejo locale plutôt que Codeberg — voir e2e/seed.mjs.
const CONFIG = window.__CMS_TEST_CONFIG__ || {
  // URL de l'instance Forgejo/Codeberg (modifiable pour pointer vers une autre instance compatible)
  instanceUrl: "https://codeberg.org",

  // Client ID de ton application OAuth2 Codeberg (public client, pas de secret)
  clientId: "386fe972-119d-4210-a9ce-7b5d961cf849",

  // Doit correspondre EXACTEMENT au Redirect URI configuré sur Codeberg et sur GitLab,
  // et être l'URL où ce fichier index.html est servi.
  redirectUri: window.location.origin + window.location.pathname,

  // Scopes demandés : lecture/écriture des dépôts, infos de base de l'utilisateur, et
  // write:user (nécessaire pour créer un nouveau dépôt via POST /user/repos)
  scope: "read:repository write:repository read:user write:user",

  // Domaine où Codeberg Pages sert les sites publiés (voir api.js:pagesUrl) —
  // non pertinent pour une instance Forgejo auto-hébergée sans pages-server.
  pagesDomain: "codeberg.page",

  // Client ID de ton application OAuth2 GitLab (public client, pas de secret) — à remplacer
  // avant de déployer, voir instructions ci-dessus. GitLab n'a pas le problème CORS de
  // GitHub sur son endpoint de token (vérifié : gitlab.com/oauth/token renvoie
  // access-control-allow-origin: *), donc contrairement à GitHub il a droit au même flow
  // OAuth2 + PKCE en un clic que Codeberg — voir providers.js et gitlab-api.js.
  gitlabClientId: "8764be920b76bd9f2730ab589ce31b1d4130427ba47d5f9b991d0c69a5c6c2fc",
};
