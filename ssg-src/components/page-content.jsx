/**
 * Intégration app (remplacement de Zola, voir docs/plan-puck-ssg.md) : composant Puck
 * "PageContent" — affiche le titre/la date/le corps HTML de la page ou de l'article
 * courant·e (`context.page`, voir ssg-src/context.js), déjà pré-rendu en HTML depuis le
 * Markdown par content-loader.js. Sans lui, aucun gabarit ne peut afficher le vrai
 * contenu d'une page/d'un article — aucune track ne l'avait construit (la palette de
 * Track D portait sur des composants de mise en page, pas sur le rendu du corps).
 *
 * dangerouslySetInnerHTML est sûr ici : le HTML vient de remark/remark-html appliqué au
 * Markdown écrit par l'auteur·ice du site elle/lui-même (même modèle de confiance que
 * le contenu Markdown -> HTML de n'importe quel générateur de site statique), pas d'un
 * contenu tiers non fiable.
 *
 * Seul endroit du renderer où du HTML "libre" (pas un composant Puck) s'affiche — les
 * balises qu'il contient (h2, ul, blockquote, code, a...) n'héritent d'aucun style sans
 * règles dédiées, d'où le <style> scopé ci-dessous plutôt que des style inline (qui ne
 * peuvent pas cibler des balises imbriquées).
 */

import { useSsgContext } from "../ssg-context.js";
import { TOKENS } from "../design-tokens.js";

const BOOL_OPTIONS = [
  { label: "Oui", value: true },
  { label: "Non", value: false },
];

const PROSE_CSS = `
.ssg-prose { color: ${TOKENS.body}; }
.ssg-prose > * + * { margin-top: 1.25em; }
.ssg-prose h2 { font-size: 1.5rem; font-weight: 700; color: ${TOKENS.ink}; margin-top: 2em; letter-spacing: -0.01em; }
.ssg-prose h3 { font-size: 1.1875rem; font-weight: 700; color: ${TOKENS.ink}; margin-top: 1.75em; }
.ssg-prose a { color: ${TOKENS.accent}; text-decoration: underline; text-underline-offset: 0.15em; }
.ssg-prose strong { color: ${TOKENS.ink}; font-weight: 700; }
.ssg-prose ul, .ssg-prose ol { padding-left: 1.375em; }
.ssg-prose li + li { margin-top: 0.4em; }
.ssg-prose blockquote { border-left: 3px solid ${TOKENS.border}; margin-left: 0; padding-left: 1.25em; color: ${TOKENS.muted}; font-style: italic; }
.ssg-prose code { background: ${TOKENS.surfaceAlt}; border-radius: 0.25rem; padding: 0.15em 0.4em; font-size: 0.875em; }
.ssg-prose pre { background: ${TOKENS.ink}; color: #f4f4f5; border-radius: ${TOKENS.radiusSm}; padding: 1.25em; overflow-x: auto; }
.ssg-prose pre code { background: none; padding: 0; }
.ssg-prose img { max-width: 100%; border-radius: ${TOKENS.radiusSm}; }
`;

export const PageContent = {
  label: "Corps de page",
  fields: {
    showTitle: { type: "radio", label: "Afficher le titre", options: BOOL_OPTIONS },
    showDate: { type: "radio", label: "Afficher la date", options: BOOL_OPTIONS },
  },
  defaultProps: {
    showTitle: true,
    showDate: true,
  },
  render: ({ showTitle, showDate }) => {
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
        <div className="ssg-prose" style={{ lineHeight: 1.7, fontSize: "1.0625rem" }} dangerouslySetInnerHTML={{ __html: current.body || "" }} />
      </article>
    );
  },
};
