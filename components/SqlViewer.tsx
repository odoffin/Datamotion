"use client";

import { sql } from "@codemirror/lang-sql";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useEffect, useRef } from "react";

const theme = EditorView.theme(
  {
    "&": {
      backgroundColor: "var(--panel)",
      color: "var(--text)",
      fontSize: "13px",
      borderRadius: "8px",
      border: "1px solid var(--border)",
    },
    ".cm-content": { fontFamily: "var(--font-jetbrains-mono), monospace", padding: "10px 4px" },
    ".cm-scroller": { fontFamily: "inherit" },
    "&.cm-focused": { outline: "none" },
  },
  { dark: true },
);

// Syntax colours chosen for ≥4.5:1 contrast on the panel colour.
const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: "#9ECBFF", fontWeight: "600" },
  { tag: [tags.number, tags.bool], color: "#B5E8B0" },
  { tag: tags.string, color: "#F7B3CF" },
  { tag: [tags.operator, tags.punctuation], color: "#F2F2F7" },
  { tag: tags.name, color: "#F2F2F7" },
]);

/** Read-only CodeMirror view of the SQL rebuilt from the slots. */
export function SqlViewer({ value, label }: { value: string; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!host.current) return;
    view.current = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: "",
        extensions: [
          sql(),
          theme,
          syntaxHighlighting(highlight),
          EditorView.lineWrapping,
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
          EditorView.contentAttributes.of({ "aria-label": label }),
        ],
      }),
    });
    return () => {
      view.current?.destroy();
      view.current = null;
    };
  }, [label]);

  useEffect(() => {
    const v = view.current;
    if (!v || v.state.doc.toString() === value) return;
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value, label]);

  return <div ref={host} />;
}
