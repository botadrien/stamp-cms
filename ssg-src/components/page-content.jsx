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
 */

import { useSsgContext } from "../ssg-context.js";

const BOOL_OPTIONS = [
  { label: "Oui", value: true },
  { label: "Non", value: false },
];

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
    if (!current) return null;
    return (
      <article style={{ maxWidth: "42rem", margin: "0 auto", padding: "3rem 1.5rem" }}>
        {showTitle && current.title ? (
          <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: "0 0 0.5rem", lineHeight: 1.2 }}>{current.title}</h1>
        ) : null}
        {showDate && current.date ? (
          <p style={{ color: "#64748b", fontSize: "0.875rem", margin: "0 0 1.5rem" }}>{current.date}</p>
        ) : null}
        <div style={{ lineHeight: 1.7, fontSize: "1.0625rem" }} dangerouslySetInnerHTML={{ __html: current.body || "" }} />
      </article>
    );
  },
};
