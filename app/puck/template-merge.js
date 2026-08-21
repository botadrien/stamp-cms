// Injecte le contenu propre à une page/un article (ContentItem.content, voir
// content-loader.js) dans le nœud ContentSlot du gabarit partagé par type de route
// (templates.page / templates.article, voir default-templates.js), juste avant le rendu
// (renderPuckPage() dans renderer.jsx). Le gabarit reste un fichier .puck.json partagé
// par toutes les pages/tous les articles de ce type (voir LAYOUT_TEMPLATE_FILES,
// app/site/site-builder.js) — seul le contenu du slot varie, item par item.
//
// Limite connue : ne cherche ContentSlot qu'au niveau racine de template.content. Si un
// futur gabarit l'imbrique dans le slot d'un autre composant (ex. une mise en page à
// colonnes), cette fusion devient un no-op silencieux et le corps de la page/l'article
// s'afficherait vide. Non problématique aujourd'hui : page/article restent des listes
// plates (Nav/ContentSlot/Footer).

const CONTENT_SLOT_TYPE = "ContentSlot";

/**
 * @param {import("@puckeditor/core").Data} template
 * @param {import("../ssg/types.js").ContentItem} item
 * @returns {import("@puckeditor/core").Data}
 */
export function mergeItemContentIntoTemplate(template, item) {
  const content = template.content.map((node) =>
    node.type === CONTENT_SLOT_TYPE
      ? { ...node, props: { ...node.props, content: item.content || [] } }
      : node,
  );
  return { ...template, content };
}
