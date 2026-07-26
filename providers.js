// Registre des fournisseurs git supportés — point d'entrée unique pour ajouter un
// fournisseur de plus (GitLab, ...) sans toucher à app.js/auth.js au-delà de cet objet.
//
// `authType` :
// - "oauth"  : flow OAuth2 + PKCE avec redirection plein-écran (voir auth.js:startLogin).
// - "token"  : jeton d'accès personnel collé à la main (voir auth.js:loginWithToken) —
//   utilisé pour GitHub, dont l'échange OAuth exige un client_secret côté serveur
//   (voir README.md, section technique) incompatible avec le principe "zéro serveur".
const GIT_PROVIDERS = {
  codeberg: {
    id: "codeberg",
    label: "Codeberg",
    authType: "oauth",
    icon: () => ICONS.codeberg,
    ApiClass: ForgejoApi,
  },
  github: {
    id: "github",
    label: "GitHub",
    authType: "token",
    icon: () => ICONS.github,
    ApiClass: GitHubApi,
  },
};
