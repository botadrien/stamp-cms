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
  // Marque GitHub officielle (Octicons "mark-github", MIT) — glyphe plein, pas le style
  // trait des icônes ci-dessus, donc ses propres attributs.
  github: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M8 0c-4.42 0-8 3.58-8 8a8.01 8.01 0 0 0 5.47 7.59c.4.08.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>`,
  // Pas la marque Codeberg officielle (données non disponibles hors-ligne) — un sapin
  // générique, clin d'œil à leur mascotte, dans le même style plein que l'icône GitHub.
  codeberg: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L4 7h2.2L3 12h3.1v3h3.8v-3H13L9.8 7H12L8 1z"/></svg>`,
  // Pas la marque GitLab officielle (données non disponibles hors-ligne) — un losange
  // générique en trois pointes, clin d'œil au logo "tanuki" à trois pans, même style
  // plein que les icônes GitHub/Codeberg ci-dessus.
  gitlab: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 14.5L1.5 8.8 3 3.5h1.6L8 8.8l3.4-5.3H13l1.5 5.3z"/></svg>`,
};
