/**
 * Composant Puck "CodeBlock" — bloc de code monospace avec étiquette de langage
 * facultative, même idée que le bloc "Code" de Gutenberg ou de Notion. Pas de coloration
 * syntaxique (aucune dépendance ajoutée pour ça) : juste un `<pre><code>` stylé, comme le
 * `pre`/`code` de PROSE_CSS (rich-text.jsx) mais utilisable hors d'un champ richtext, en
 * bloc autonome. Statique, aucun champ binding — comme Hero/Cta/FeatureGrid (voir leurs
 * docstrings). Enregistré à la fois dans la palette complète (app/puck/registry.jsx) et
 * dans la Config restreinte de l'éditeur de contenu (editor-src/puck-content-editor.jsx),
 * voir callout.jsx pour l'explication.
 */

import { cssVar } from "../design-tokens.js";

export const CodeBlock = {
  label: "Bloc de code",
  fields: {
    code: { type: "textarea", label: "Code" },
    language: { type: "text", label: "Langage (étiquette facultative)" },
  },
  defaultProps: {
    code: "",
    language: "",
  },
  render: ({ code, language }) => {
    if (!code) return null;
    return (
      <div style={{ position: "relative", margin: "1.5rem 0" }}>
        <pre
          style={{
            margin: 0,
            backgroundColor: cssVar("ink"),
            color: "#f4f4f5",
            borderRadius: cssVar("radiusSm"),
            padding: "1.25rem",
            overflowX: "auto",
          }}
        >
          <code
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: "0.875rem",
              whiteSpace: "pre",
            }}
          >
            {code}
          </code>
        </pre>
        {language ? (
          <span
            style={{
              position: "absolute",
              top: "0.625rem",
              right: "0.875rem",
              fontSize: "0.75rem",
              fontFamily: cssVar("fontFamily"),
              color: "#a1a1aa",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {language}
          </span>
        ) : null}
      </div>
    );
  },
};
