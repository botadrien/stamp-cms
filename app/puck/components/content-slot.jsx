/**
 * Composant Puck "ContentSlot" — hôte du corps réel d'une page/d'un article dans le
 * gabarit partagé par type de route (`templates/page.puck.json` / `templates/article.
 * puck.json`, voir app/ssg/default-templates.js). Remplace l'ancien "PageContent", qui
 * affichait du HTML pré-rendu depuis du Markdown (`context.page.body`) : ici, le champ
 * `content` est un vrai slot Puck (`type: "slot"`), et son contenu réel est injecté par
 * app/puck/template-merge.js juste avant le rendu (voir buildSite() dans renderer.jsx) —
 * jamais celui, figé, stocké dans le fichier de gabarit lui-même (verrouillé en lecture
 * seule dans le canvas "Mise en page", voir default-templates.js).
 *
 * Titre/date restent affichés directement depuis `context.page` (désormais sourcés
 * depuis root.props du fichier .puck.json de la page/l'article, voir content-loader.js)
 * — seul le mécanisme d'affichage du corps a changé.
 */

import { useSsgContext } from "../ssg-context.js";
import { TOKENS } from "../design-tokens.js";
import { PROSE_CSS } from "./rich-text.jsx";

const BOOL_OPTIONS = [
  { label: "Oui", value: true },
  { label: "Non", value: false },
];

export const ContentSlot = {
  label: "Corps de page",
  fields: {
    showTitle: { type: "radio", label: "Afficher le titre", options: BOOL_OPTIONS },
    showDate: { type: "radio", label: "Afficher la date", options: BOOL_OPTIONS },
    content: { type: "slot" },
  },
  defaultProps: {
    showTitle: true,
    showDate: true,
  },
  render: ({ showTitle, showDate, content }) => {
    const context = useSsgContext();
    const current = context.page;
    if (!current) {
      // Pas de page courante (ex. canvas de l'éditeur de mise en page sur un site sans
      // aucun contenu encore) — un placeholder plutôt que `null`, pour que le bloc reste
      // sélectionnable/visible dans le canvas Puck au lieu de disparaître.
      return (
        <div
          style={{
            maxWidth: "42rem",
            margin: "0 auto",
            padding: "3.5rem 1.5rem",
            color: TOKENS.muted,
            fontFamily: TOKENS.fontFamily,
            fontStyle: "italic",
          }}
        >
          Corps de la page — aucun contenu à prévisualiser ici.
        </div>
      );
    }
    return (
      <article style={{ maxWidth: "42rem", margin: "0 auto", padding: "3.5rem 1.5rem", fontFamily: TOKENS.fontFamily }}>
        <style>{PROSE_CSS}</style>
        {showTitle && current.title ? (
          <h1
            style={{
              fontSize: "2.25rem",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: TOKENS.ink,
              margin: "0 0 0.5rem",
              lineHeight: 1.15,
            }}
          >
            {current.title}
          </h1>
        ) : null}
        {showDate && current.date ? (
          <p style={{ color: TOKENS.muted, fontSize: "0.875rem", margin: "0 0 2rem" }}>{current.date}</p>
        ) : null}
        {content()}
      </article>
    );
  },
};
