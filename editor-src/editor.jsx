// Éditeur riche (BlockNote.js, sur ProseMirror) — bundlé avec esbuild (voir
// package.json:build) car BlockNote + React + ProseMirror sont trop imbriqués pour être
// chargés fiablement via des import maps CDN sans bundler (duplication de singletons
// ProseMirror entre le point d'entrée principal et ses sous-modules). Exposé en IIFE sur
// window.RichEditor pour rester utilisable depuis les scripts classiques (app.js).
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView, lightDefaultTheme, darkDefaultTheme } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";

let root = null;
let editorRef = null;

// L'app a un thème clair/sombre bascule par l'utilisateur (bouton dans le header, voir
// app.js:toggleTheme) ; BlockNote rendait par défaut son propre thème Mantine clair fixe,
// d'où la boîte blanche incongrue quand l'admin est en dark. On repart de sa base
// light/dark et on remplace juste ses couleurs par les custom properties de l'app, lues
// sur :root (le data-theme est déjà posé au moment où ce code tourne — voir le script
// inline dans <head>) — une seule source de vérité plutôt que dupliquer les hex ici.
function appBlockNoteTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const base = isDark ? darkDefaultTheme : lightDefaultTheme;
  const root = getComputedStyle(document.documentElement);
  const v = (name) => root.getPropertyValue(name).trim();
  return {
    ...base,
    colors: {
      ...base.colors,
      editor: { text: v("--text"), background: v("--panel") },
      menu: { text: v("--text"), background: v("--panel") },
      tooltip: { text: v("--text"), background: v("--bg") },
      hovered: { text: v("--text"), background: v("--bg") },
      selected: { text: "#ffffff", background: v("--accent") },
      border: v("--border"),
      sideMenu: v("--muted"),
    },
    borderRadius: 8,
    fontFamily: getComputedStyle(document.body).fontFamily,
  };
}

function EditorApp({ initialMarkdown, onReady, onChange }) {
  const editor = useCreateBlockNote();
  const [, setLoaded] = useState(false);
  const [theme, setTheme] = useState(appBlockNoteTheme);

  // L'éditeur est une île React montée une fois (voir mount() plus bas) ; le bouton de
  // thème vit hors de cette île, dans le HTML classique — sans cet event, basculer le
  // thème pendant que l'éditeur est ouvert le laisserait sur ses couleurs figées au montage.
  useEffect(() => {
    const onThemeChange = () => setTheme(appBlockNoteTheme());
    window.addEventListener("cms-theme-change", onThemeChange);
    return () => window.removeEventListener("cms-theme-change", onThemeChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (initialMarkdown && initialMarkdown.trim()) {
        const blocks = await editor.tryParseMarkdownToBlocks(initialMarkdown);
        if (!cancelled) await editor.replaceBlocks(editor.document, blocks);
      }
      if (!cancelled) {
        editorRef = editor;
        setLoaded(true);
        if (onChange) editor.onChange(() => onChange());
        onReady?.();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <BlockNoteView editor={editor} theme={theme} />;
}

// onChange (optionnel) : notifié à chaque modification du contenu (aperçu en direct,
// voir app.js) — pas de valeur passée, l'appelant relit via getMarkdown() s'il en a
// besoin, pour ne jamais désynchroniser deux façons différentes de lire l'état éditeur.
export function mount(elementId, initialMarkdown = "", onChange) {
  unmount();
  const el = document.getElementById(elementId);
  root = createRoot(el);
  return new Promise((resolve) => {
    root.render(<EditorApp initialMarkdown={initialMarkdown} onReady={resolve} onChange={onChange} />);
  });
}

export async function getMarkdown() {
  if (!editorRef) return "";
  return editorRef.blocksToMarkdownLossy(editorRef.document);
}

export function unmount() {
  if (root) {
    root.unmount();
    root = null;
  }
  editorRef = null;
}
