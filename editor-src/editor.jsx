// Éditeur riche (BlockNote.js, sur ProseMirror) — bundlé avec esbuild (voir
// package.json:build) car BlockNote + React + ProseMirror sont trop imbriqués pour être
// chargés fiablement via des import maps CDN sans bundler (duplication de singletons
// ProseMirror entre le point d'entrée principal et ses sous-modules). Exposé en IIFE sur
// window.RichEditor pour rester utilisable depuis les scripts classiques (app.js).
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";

let root = null;
let editorRef = null;

function EditorApp({ initialMarkdown, onReady }) {
  const editor = useCreateBlockNote();
  const [, setLoaded] = useState(false);

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
        onReady?.();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <BlockNoteView editor={editor} />;
}

export function mount(elementId, initialMarkdown = "") {
  unmount();
  const el = document.getElementById(elementId);
  root = createRoot(el);
  return new Promise((resolve) => {
    root.render(<EditorApp initialMarkdown={initialMarkdown} onReady={resolve} />);
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
