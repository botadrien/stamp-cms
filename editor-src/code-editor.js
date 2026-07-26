// Éditeur de code (CodeMirror 6) pour l'onglet Templates — coloration HTML (le plus
// proche de Tera pour la coloration, pas de mode Tera natif). Bundlé en IIFE sur
// window.CodeEditor, même principe et même forme d'API que editor.jsx (RichEditor) :
// mount(elId, initialCode, onChange) / getCode() / unmount().
import { EditorView, basicSetup } from "codemirror";
import { html } from "@codemirror/lang-html";

let view = null;

// onChange (optionnel) : notifié à chaque modification du contenu (aperçu en direct, voir
// app.js) — pas de valeur passée, l'appelant relit via getCode() s'il en a besoin, comme
// RichEditor.mount().
export function mount(elementId, initialCode = "", onChange) {
  unmount();
  const el = document.getElementById(elementId);
  view = new EditorView({
    doc: initialCode,
    extensions: [
      basicSetup,
      html(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && onChange) onChange();
      }),
    ],
    parent: el,
  });
  return Promise.resolve();
}

export function getCode() {
  return view ? view.state.doc.toString() : "";
}

export function unmount() {
  if (view) {
    view.destroy();
    view = null;
  }
}
