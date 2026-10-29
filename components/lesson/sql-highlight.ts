import { HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/** SQL colours from the Ledger tokens: keywords --key, numbers --num. */
export const ledgerSqlHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--key)", fontWeight: "500" },
  { tag: [tags.number, tags.bool], color: "var(--num)" },
  { tag: [tags.string, tags.operator, tags.punctuation, tags.name], color: "var(--ink)" },
  { tag: tags.comment, color: "var(--muted)" },
]);
