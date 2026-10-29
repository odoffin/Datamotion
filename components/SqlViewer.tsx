"use client";

import { sql } from "@codemirror/lang-sql";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useEffect, useRef } from "react";

// Written on the slip: no box of its own, just an ink underline.
const theme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    color: "var(--ink)",
    fontSize: "clamp(16px, 2.4vw, 21px)",
    borderBottom: "2px solid var(--ink)",
  },
  ".cm-content": { fontFamily: "var(--font-plex-mono), monospace", padding: "10px 0" },
  ".cm-line": { padding: "0 2px" },
  ".cm-scroller": { fontFamily: "inherit", lineHeight: "1.4" },
  "&.cm-focused": { outline: "none" },
});

const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--key)", fontWeight: "500" },
  { tag: [tags.number, tags.bool], color: "var(--num)" },
  { tag: [tags.string, tags.operator, tags.punctuation, tags.name], color: "var(--ink)" },
  { tag: tags.comment, color: "var(--muted)" },
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
