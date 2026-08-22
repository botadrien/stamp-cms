/**
 * Icônes par plateforme pour le composant "SocialLinks" (app/puck/components/social-links.jsx)
 * — distinct de component-icons.jsx (icônes de la palette Puck, sidebar de l'éditeur) :
 * ici les icônes sont affichées dans le HTML publié du site, pas dans l'UI de l'éditeur.
 */

const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export const socialIcons = {
  github: (
    <svg {...base}>
      <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.6 2.8 5.5 3.1 5.5 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
    </svg>
  ),
  mastodon: (
    <svg {...base}>
      <rect x="4" y="3" width="16" height="13" rx="4" />
      <path d="M8 16v2.5M16 16v2.5M9 8v3M12 8v3M15 8v3" />
    </svg>
  ),
  rss: (
    <svg {...base}>
      <circle cx="6" cy="18" r="1.5" fill="currentColor" stroke="none" />
      <path d="M4 11a9 9 0 0 1 9 9M4 5a15 15 0 0 1 15 15" />
    </svg>
  ),
  twitter: (
    <svg {...base}>
      <path d="M21 5.5c-.7.3-1.5.6-2.3.7a4 4 0 0 0 1.7-2.2 8 8 0 0 1-2.5 1 4 4 0 0 0-6.8 3.6A11.3 11.3 0 0 1 3 4.6a4 4 0 0 0 1.2 5.3 4 4 0 0 1-1.8-.5v.1a4 4 0 0 0 3.2 3.9 4 4 0 0 1-1.8.1 4 4 0 0 0 3.7 2.8A8 8 0 0 1 2 17.9a11.3 11.3 0 0 0 6.1 1.8c7.3 0 11.3-6 11.3-11.3v-.5A8 8 0 0 0 21 5.5Z" />
    </svg>
  ),
  linkedin: (
    <svg {...base}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7.5 10v6M7.5 7.5v.01M12 16v-3.5c0-1.4 1-2.5 2.2-2.5s2.3 1 2.3 2.5V16" />
    </svg>
  ),
  instagram: (
    <svg {...base}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  ),
  email: (
    <svg {...base}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  ),
  custom: (
    <svg {...base}>
      <path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1.5 1.5" />
      <path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1.5-1.5" />
    </svg>
  ),
};
