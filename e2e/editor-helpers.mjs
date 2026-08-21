// Aide partagée entre les specs qui tapent du texte dans l'éditeur de contenu Puck (voir
// editor-src/puck-content-editor.jsx).
//
// Pièges constatés en pratique (voir historique de ce fichier / discussions liées) :
// - Deux éléments [contenteditable=true] existent une fois le bloc RichText par défaut
//   sélectionné : un "fantôme" de taille nulle (superposition canvas inutilisée sans
//   iframe, voir le commentaire dans puck-content-editor.jsx) et l'instance réellement
//   utilisable, dans le panneau de champs (sidebar droite) — on cible cette dernière
//   explicitement (via sa classe Puck, prefixe stable même si le hash de suffixe varie)
//   plutôt que de trier par taille/visibilité.
// - Recliquer sur un bloc déjà sélectionné échoue : son ActionBar (superposition
//   dupliquer/supprimer) intercepte alors les clics à cet endroit — d'où l'étape de
//   sélection sautée si le champ du panneau est déjà présent.
// - Puck débounce son onChange interne (~200ms, RichTextEditor/lib/use-synced-editor.ts
//   dans @puckeditor/core) avant de remonter le HTML tapé dans l'état de l'app — cliquer
//   "Publier" immédiatement après la frappe (ce qu'un test automatisé fait, contrairement
//   à un·e utilisateur·ice réel·le) peut donc publier un corps sans la toute dernière
//   frappe. On attend explicitement que PuckContentEditor.getData() reflète vraiment le
//   texte tapé plutôt qu'un délai fixe arbitraire.

export async function typeInRichTextEditor(page, text, { scope = "#editorMount" } = {}) {
  // Cible spécifiquement l'instance Tiptap réelle (classes .tiptap.ProseMirror) plutôt
  // qu'un [contenteditable=true] générique : pendant le lazy-load de l'éditeur richtext
  // (React.lazy, @puckeditor/core), un fallback statique (EditorFallback) occupe le même
  // emplacement avec les mêmes attributs contenteditable="true"/class="rich-text" — y
  // taper modifie bien le DOM (donc pas d'erreur), mais rien ne remonte jamais dans
  // PuckContentEditor.getData() (pas de ProseMirror, pas d'onChange).
  const sidebarEditable = page.locator(`${scope} [class*="Sidebar--right"] .tiptap.ProseMirror[contenteditable=true]`);
  if ((await sidebarEditable.count()) === 0) {
    await page.locator(`${scope} [data-puck-component]`).first().click();
  }
  await sidebarEditable.first().click();
  await page.keyboard.type(text);
  await page.waitForFunction(
    (needle) => {
      const data = window.PuckContentEditor && window.PuckContentEditor.getData();
      return !!data && JSON.stringify(data).includes(needle);
    },
    text.slice(-10),
    { timeout: 5000 },
  );
}
