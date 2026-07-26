// Petit jeu d'icônes SVG en ligne pour la barre latérale — pas de police d'icônes ni de
// CDN (voir README, section "Principes clés" : zéro serveur, zéro dépendance externe).
// `currentColor` sur stroke/fill : héritent automatiquement de la couleur du texte du
// lien parent (donc du hover/.active de .sidebar-nav-item sans variante séparée).
const ICON_SVG_ATTRS = 'width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';

const ICONS = {
  pages: `<svg ${ICON_SVG_ATTRS}><path d="M5 2h6l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><path d="M11 2v4h4"/></svg>`,
  posts: `<svg ${ICON_SVG_ATTRS}><rect x="2" y="3" width="16" height="14" rx="1"/><line x1="5" y1="7" x2="15" y2="7"/><line x1="5" y1="10" x2="15" y2="10"/><line x1="5" y1="13" x2="11" y2="13"/></svg>`,
  settings: `<svg ${ICON_SVG_ATTRS}><line x1="3" y1="5" x2="17" y2="5"/><circle cx="12" cy="5" r="1.6" fill="currentColor"/><line x1="3" y1="10" x2="17" y2="10"/><circle cx="7" cy="10" r="1.6" fill="currentColor"/><line x1="3" y1="15" x2="17" y2="15"/><circle cx="13" cy="15" r="1.6" fill="currentColor"/></svg>`,
  back: `<svg ${ICON_SVG_ATTRS}><path d="M12 4l-6 6 6 6"/></svg>`,
  external: `<svg ${ICON_SVG_ATTRS}><path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3"/><path d="M11 3h6v6"/><path d="M9 11l8-8"/></svg>`,
  sun: `<svg ${ICON_SVG_ATTRS}><circle cx="10" cy="10" r="4"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.5 4.5l1.4 1.4M14.1 14.1l1.4 1.4M4.5 15.5l1.4-1.4M14.1 5.9l1.4-1.4"/></svg>`,
  moon: `<svg ${ICON_SVG_ATTRS}><path d="M17 11.5A7.5 7.5 0 1 1 8.5 3a6 6 0 0 0 8.5 8.5z"/></svg>`,
};
