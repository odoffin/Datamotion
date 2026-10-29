"use client";

import { sql } from "@codemirror/lang-sql";
import { syntaxHighlighting } from "@codemirror/language";
import { EditorState, Prec } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { useEffect, useRef } from "react";
import { ledgerSqlHighlight } from "./sql-highlight";

// Written straight onto the slip: no box, just an ink underline.
const theme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    color: "var(--ink)",
    fontSize: "clamp(17px, 2.4vw, 21px)",
    borderBottom: "2px solid var(--ink)",
  },
  ".cm-content": {
    fontFamily: "var(--font-plex-mono), monospace",
    padding: "10px 0",
    caretColor: "var(--ink)",
    minHeight: "2.6em",
  },
  ".cm-line": { padding: "0 2px" },
  ".cm-scroller": { fontFamily: "inherit", lineHeight: "1.45" },
  ".cm-placeholder": { color: "var(--muted)" },
  "&.cm-focused": { outline: "2px solid var(--ink)", outlineOffset: "3px" },
  ".cm-cursor": { borderLeftColor: "var(--ink)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: "var(--rule) !important" },
});

interface QueryEditorProps {
  value: string;
  onChange: (sql: string) => void;
  /** Enter runs; Shift+Enter inserts a newline. */
  onRun: () => void;
  label: string;
  describedBy?: string;
}

/** Multi-line CodeMirror 6 SQL editor for the request slip. */
export function QueryEditor({ value, onChange, onRun, label, describedBy }: QueryEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  // Latest callbacks without rebuilding the editor.
  const handlers = useRef({ onChange, onRun });
  useEffect(() => {
    handlers.current = { onChange, onRun };
  });

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          Prec.highest(
            keymap.of([
              { key: "Enter", run: () => (handlers.current.onRun(), true) },
              { key: "Mod-Enter", run: () => (handlers.current.onRun(), true) },
              {
                key: "Shift-Enter",
                run: (v) => (v.dispatch(v.state.replaceSelection("\n"), { scrollIntoView: true }), true),
              },
            ]),
          ),
          sql(),
          theme,
          syntaxHighlighting(ledgerSqlHighlight),
          EditorView.lineWrapping,
          placeholder("SELECT * FROM orders"),
          EditorView.contentAttributes.of({
            "aria-label": label,
            "aria-multiline": "true",
            spellcheck: "false",
            autocapitalize: "off",
            autocorrect: "off",
            ...(describedBy ? { "aria-describedby": describedBy } : {}),
          }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) handlers.current.onChange(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // The editor is created once; `value` is synced by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, describedBy]);

  // Outside changes (Start over) replace the text.
  useEffect(() => {
    const v = view.current;
    if (!v || v.state.doc.toString() === value) return;
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  return <div ref={host} />;
}
