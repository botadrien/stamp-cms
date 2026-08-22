/**
 * Composant Puck "SocialLinks" — rangée d'icônes de réseaux sociaux/contact (GitHub,
 * Mastodon, RSS... voir app/puck/social-icons.jsx). Reprend la même forme de champ que
 * `Footer.links` ({label, url}, voir footer.jsx) avec un `platform` en plus (choix de
 * l'icône), plutôt qu'inventer une structure de données différente. Statique, aucun champ
 * binding — comme Hero/Cta/FeatureGrid (voir leurs docstrings). Enregistré uniquement dans
 * la palette complète (app/puck/registry.jsx) : section de mise en page, pas un bloc de
 * corps d'article.
 */

import { cssVar } from "../design-tokens.js";
import { socialIcons } from "../social-icons.jsx";

const PLATFORM_OPTIONS = [
  { label: "GitHub", value: "github" },
  { label: "Mastodon", value: "mastodon" },
  { label: "RSS", value: "rss" },
  { label: "Twitter / X", value: "twitter" },
  { label: "LinkedIn", value: "linkedin" },
  { label: "Instagram", value: "instagram" },
  { label: "E-mail", value: "email" },
  { label: "Autre (icône générique)", value: "custom" },
];

export const SocialLinks = {
  label: "Réseaux sociaux",
  fields: {
    links: {
      type: "array",
      label: "Liens",
      arrayFields: {
        platform: { type: "select", label: "Plateforme", options: PLATFORM_OPTIONS },
        url: { type: "text", label: "Lien" },
        label: { type: "text", label: "Libellé accessible (optionnel)" },
      },
      getItemSummary: (item) => PLATFORM_OPTIONS.find((o) => o.value === item?.platform)?.label || "Lien",
      defaultItemProps: { platform: "github", url: "#", label: "" },
    },
  },
  defaultProps: {
    links: [],
  },
  render: ({ links }) => {
    const items = (Array.isArray(links) ? links : []).filter((link) => link?.url);
    if (items.length === 0) return null;
    return (
      <div style={{ display: "flex", gap: "1rem", padding: "0.5rem 0" }}>
        {items.map((link, index) => (
          <a
            key={index}
            href={link.url}
            aria-label={link.label || link.platform}
            style={{ color: cssVar("body"), display: "inline-flex", alignItems: "center" }}
          >
            {socialIcons[link.platform] || socialIcons.custom}
          </a>
        ))}
      </div>
    );
  },
};
