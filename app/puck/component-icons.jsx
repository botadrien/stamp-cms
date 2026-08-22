/**
 * Icônes de la palette Puck (sidebar gauche, éditeurs de mise en page et de contenu) —
 * associe chaque nom de composant enregistré (voir registry.jsx et
 * editor-src/puck-content-editor.jsx) à un pictogramme SVG 16x16, affiché via
 * overrides.drawerItem (voir editor-src/puck-layout-editor.jsx et puck-content-editor.jsx).
 */

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export const componentIcons = {
  Hero: (
    <svg {...base}>
      <rect x="3" y="4" width="18" height="14" rx="1.5" />
      <circle cx="8" cy="9.5" r="1.5" />
      <path d="M3 15l5-4 4 3 5-5 4 4" />
    </svg>
  ),
  FeatureGrid: (
    <svg {...base}>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </svg>
  ),
  Cta: (
    <svg {...base}>
      <rect x="3" y="8" width="18" height="8" rx="4" />
      <path d="M9 12h6M13 9l3 3-3 3" />
    </svg>
  ),
  ArticleCard: (
    <svg {...base}>
      <rect x="3" y="3" width="18" height="18" rx="1.5" />
      <path d="M3 10h18" />
      <path d="M7 14h10M7 17h6" />
    </svg>
  ),
  ArticleTeaser: (
    <svg {...base}>
      <rect x="3" y="4" width="7" height="7" rx="1" />
      <path d="M13 5h8M13 9h8M13 13h8M3 15h18M3 19h12" />
    </svg>
  ),
  Nav: (
    <svg {...base}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M3 12h18M3 17h18" opacity="0.4" />
    </svg>
  ),
  Footer: (
    <svg {...base}>
      <path d="M3 6h18M3 11h18" opacity="0.4" />
      <rect x="3" y="16" width="18" height="4" rx="1" />
    </svg>
  ),
  Repeater: (
    <svg {...base}>
      <rect x="3" y="3" width="12" height="8" rx="1" />
      <rect x="9" y="13" width="12" height="8" rx="1" />
    </svg>
  ),
  ContentSlot: (
    <svg {...base}>
      <rect x="3" y="3" width="18" height="18" rx="1.5" strokeDasharray="3 3" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  ),
  RichText: (
    <svg {...base}>
      <path d="M4 6h16M4 11h16M4 16h10" />
    </svg>
  ),
  Heading: (
    <svg {...base}>
      <path d="M5 5v14M15 5v14M5 12h10" />
      <circle cx="18.5" cy="17.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  ),
  Callout: (
    <svg {...base}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20l3-4" />
      <path d="M12 8v3" />
      <circle cx="12" cy="13.2" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  ),
  Quote: (
    <svg {...base}>
      <path d="M6 12c0-2.5 1.3-4.2 3.5-4.8" />
      <path d="M6.3 12c1.2 0 2.2 1 2.2 2.2S7.5 16.4 6.3 16.4 4 15.4 4 14.2" />
      <path d="M14.5 12c0-2.5 1.3-4.2 3.5-4.8" />
      <path d="M14.8 12c1.2 0 2.2 1 2.2 2.2s-1 2.2-2.2 2.2-2.3-1-2.3-2.2" />
    </svg>
  ),
  Divider: (
    <svg {...base}>
      <path d="M4 12h4M10 12h4M16 12h4" />
    </svg>
  ),
  CodeBlock: (
    <svg {...base}>
      <path d="M8 6l-5 6 5 6M16 6l5 6-5 6" />
    </svg>
  ),
  Accordion: (
    <svg {...base}>
      <rect x="3" y="4" width="18" height="5" rx="1" />
      <rect x="3" y="11" width="18" height="5" rx="1" opacity="0.4" />
      <path d="M17 6l1.5 1.5L20 6" />
    </svg>
  ),
  Space: (
    <svg {...base}>
      <path d="M12 3v6M12 15v6" />
      <path d="M9 6l3-3 3 3M9 18l3 3 3-3" />
    </svg>
  ),
  Image: (
    <svg {...base}>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M3 16l5.5-5 4 4 3-3 5.5 5" />
    </svg>
  ),
  Testimonial: (
    <svg {...base}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20l1-4" />
      <path d="M8.5 8c-1.4 0-2.2.9-2.2 2.1S7.1 12 8.5 12s2-.8 2-1.9c0-1.7-1-3-2.7-3.3" />
      <path d="M15 8c-1.4 0-2.2.9-2.2 2.1s.8 1.9 2.2 1.9 2-.8 2-1.9c0-1.7-1-3-2.7-3.3" />
    </svg>
  ),
  LogoCloud: (
    <svg {...base}>
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9.5" y="6" width="5" height="8" rx="1" />
      <rect x="17" y="9" width="5" height="5" rx="1" />
    </svg>
  ),
  Stats: (
    <svg {...base}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  ),
  SocialLinks: (
    <svg {...base}>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" />
    </svg>
  ),
  PricingTable: (
    <svg {...base}>
      <path d="M5 20V13M12 20V6M19 20v-5" />
      <path d="M9 9l2 2 4-4" />
    </svg>
  ),
  TagList: (
    <svg {...base}>
      <path d="M11 3H4v7l9.5 9.5a2 2 0 0 0 2.8 0l4.2-4.2a2 2 0 0 0 0-2.8L11 3Z" />
      <circle cx="8" cy="8" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  ),
};
