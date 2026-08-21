/**
 * Track D (voir docs/plan-puck-ssg.md) : composant Puck "Footer", statique — pas de
 * champ binding. Style en custom properties CSS + style inline, pas de Sass.
 */

export const Footer = {
  label: "Footer",
  fields: {
    siteName: { type: "text", label: "Nom du site" },
    tagline: { type: "text", label: "Baseline" },
    links: {
      type: "array",
      label: "Liens",
      arrayFields: {
        label: { type: "text", label: "Libellé" },
        url: { type: "text", label: "Lien" },
      },
      getItemSummary: (item) => item?.label || "Lien",
      defaultItemProps: { label: "Lien", url: "#" },
    },
    copyright: { type: "text", label: "Mention de copyright" },
    backgroundColor: { type: "text", label: "Couleur de fond (hex)" },
    textColor: { type: "text", label: "Couleur du texte (hex)" },
  },
  defaultProps: {
    siteName: "",
    tagline: "",
    links: [],
    copyright: "",
    backgroundColor: "#0f172a",
    textColor: "#e2e8f0",
  },
  render: ({ siteName, tagline, links, copyright, backgroundColor, textColor }) => {
    const items = Array.isArray(links) ? links : [];
    return (
      <footer
        style={{
          "--ssg-footer-bg": backgroundColor || "#0f172a",
          "--ssg-footer-fg": textColor || "#e2e8f0",
          backgroundColor: "var(--ssg-footer-bg)",
          color: "var(--ssg-footer-fg)",
          padding: "3rem 1.5rem",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1.5rem",
        }}
      >
        <div>
          {siteName ? <p style={{ fontWeight: 700, margin: 0 }}>{siteName}</p> : null}
          {tagline ? <p style={{ margin: "0.25rem 0 0", opacity: 0.75, fontSize: "0.875rem" }}>{tagline}</p> : null}
        </div>
        {items.length > 0 ? (
          <nav style={{ display: "flex", gap: "1.25rem" }}>
            {items.map((link, index) => (
              <a key={link.url ?? index} href={link.url ?? "#"} style={{ color: "inherit", textDecoration: "none" }}>
                {link.label}
              </a>
            ))}
          </nav>
        ) : null}
        {copyright ? <p style={{ margin: 0, opacity: 0.6, fontSize: "0.8125rem" }}>{copyright}</p> : null}
      </footer>
    );
  },
};
