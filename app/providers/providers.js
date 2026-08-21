// Registre des fournisseurs git supportés — point d'entrée unique pour ajouter un
// fournisseur de plus sans toucher à app/app.js au-delà de cet objet.
//
// `authType` :
// - "oauth"  : flow OAuth2 + PKCE avec redirection plein-écran (voir app/auth/auth.js:startLogin) —
//   la config `oauth` ci-dessous fournit à app/auth/auth.js tout ce qui varie d'un fournisseur OAuth
//   à l'autre (endpoints, clientId, scope, redirectUri).
// - "token"  : jeton d'accès personnel collé à la main (voir app/auth/auth.js:loginWithToken) —
//   utilisé pour GitHub, dont l'échange OAuth exige un client_secret côté serveur
//   (voir README.md, section technique) incompatible avec le principe "zéro serveur".
const GIT_PROVIDERS = {
  codeberg: {
    id: "codeberg",
    label: "Codeberg",
    authType: "oauth",
    icon: () => ICONS.codeberg,
    ApiClass: ForgejoApi,
    oauth: {
      authEndpoint: `${CONFIG.instanceUrl}/login/oauth/authorize`,
      tokenEndpoint: `${CONFIG.instanceUrl}/login/oauth/access_token`,
      clientId: CONFIG.clientId,
      scope: CONFIG.scope,
      redirectUri: CONFIG.redirectUri,
    },
  },
  github: {
    id: "github",
    label: "GitHub",
    authType: "token",
    icon: () => ICONS.github,
    ApiClass: GitHubApi,
  },
  gitlab: {
    id: "gitlab",
    label: "GitLab",
    authType: "oauth",
    icon: () => ICONS.gitlab,
    ApiClass: GitLabApi,
    oauth: {
      // gitlab.com uniquement (pas de self-hosted, voir README) — endpoints fixes.
      authEndpoint: "https://gitlab.com/oauth/authorize",
      tokenEndpoint: "https://gitlab.com/oauth/token",
      clientId: CONFIG.gitlabClientId,
      // "api" nécessaire : "write_repository" ne couvre que le Git-over-HTTP, pas les
      // écritures via l'API REST (contents/commits) qu'on utilise ici.
      scope: "api",
      redirectUri: CONFIG.redirectUri,
    },
  },
};
