import { lex, type Token } from "@/engine/lex";

const COLOUR: Partial<Record<Token["kind"], string>> = { keyword: "text-key font-medium", number: "text-num" };

/** A read-only line of SQL in the Ledger colours, keeping the learner's spacing. */
export function SqlLine({ sql }: { sql: string }) {
  const tokens = lex(sql);
  const parts: { text: string; className?: string }[] = [];
  let at = 0;
  for (const t of tokens) {
    if (t.start > at) parts.push({ text: sql.slice(at, t.start) });
    parts.push({ text: t.text, className: COLOUR[t.kind] });
    at = t.end;
  }
  if (at < sql.length) parts.push({ text: sql.slice(at) });
  return (
    <code className="block whitespace-pre-wrap break-words font-mono text-[15px] text-ink">
      {parts.map((p, i) => (
        <span key={i} className={p.className}>
          {p.text}
        </span>
      ))}
    </code>
  );
}
