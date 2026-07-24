// Configuration du POC — à adapter avant de déployer.
//
// 1. Va sur https://codeberg.org/user/settings/applications
// 2. Crée une nouvelle application OAuth2 :
//      - Nom : ce que tu veux (ex. "CMS Statique POC")
//      - Redirect URI : l'URL exacte où tu déploies ce POC (ex. https://tonuser.codeberg.page/cms-poc/)
//      - IMPORTANT : décoche "Confidential Client" pour forcer PKCE (pas de secret nécessaire)
// 3. Copie le "Client ID" généré ci-dessous.

// Les tests e2e (voir e2e/) injectent window.__CMS_TEST_CONFIG__ avant ce script pour
// pointer vers l'instance Forgejo locale plutôt que Codeberg — voir e2e/seed.mjs.
const CONFIG = window.__CMS_TEST_CONFIG__ || {
  // URL de l'instance Forgejo/Codeberg (modifiable pour pointer vers une autre instance compatible)
  instanceUrl: "https://codeberg.org",

  // Client ID de ton application OAuth2 (public client, pas de secret)
  clientId: "386fe972-119d-4210-a9ce-7b5d961cf849",

  // Doit correspondre EXACTEMENT au Redirect URI configuré sur Codeberg,
  // et être l'URL où ce fichier index.html est servi.
  redirectUri: window.location.origin + window.location.pathname,

  // Scopes demandés : lecture/écriture des dépôts, infos de base de l'utilisateur, et
  // write:user (nécessaire pour créer un nouveau dépôt via POST /user/repos)
  scope: "read:repository write:repository read:user write:user",

  // Domaine où Codeberg Pages sert les sites publiés (voir api.js:pagesUrl) —
  // non pertinent pour une instance Forgejo auto-hébergée sans pages-server.
  pagesDomain: "codeberg.page",
};
