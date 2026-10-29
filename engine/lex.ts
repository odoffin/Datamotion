export type TokenKind = "keyword" | "word" | "number" | "string" | "ident" | "op" | "punct";

export interface Token {
  text: string;
  kind: TokenKind;
  /** Offsets into the learner's text, end exclusive. */
  start: number;
  end: number;
  /** A string or quoted identifier that never closes. */
  unterminated?: boolean;
}

export const SQL_KEYWORDS = new Set([
  "select", "from", "where", "and", "or", "not", "between", "in", "like", "ilike",
  "is", "null", "order", "group", "by", "having", "limit", "offset", "join", "inner",
  "left", "right", "full", "outer", "cross", "on", "as", "distinct", "with", "union",
  "all", "except", "intersect", "case", "when", "then", "else", "end", "asc", "desc",
  "true", "false", "using", "exists",
]);

const OPERATORS = ["<=", ">=", "<>", "!=", "==", "||", "::", "=", "<", ">", "+", "-", "*", "/", "%"];

/**
 * Splits SQL into tokens with offsets: words, numbers, operators, strings and
 * punctuation. Whitespace and comments are skipped. Never throws.
 */
export function lex(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i] ?? "";
    const rest = sql.slice(i);
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (rest.startsWith("--")) {
      const nl = sql.indexOf("\n", i);
      i = nl === -1 ? sql.length : nl;
      continue;
    }
    if (rest.startsWith("/*")) {
      const close = sql.indexOf("*/", i + 2);
      i = close === -1 ? sql.length : close + 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      let j = i + 1;
      let closed = false;
      while (j < sql.length) {
        if (sql[j] === ch) {
          if (sql[j + 1] === ch) j += 2;
          else {
            closed = true;
            j++;
            break;
          }
        } else j++;
      }
      tokens.push({
        text: sql.slice(i, j),
        kind: ch === "'" ? "string" : "ident",
        start: i,
        end: j,
        ...(closed ? {} : { unterminated: true }),
      });
      i = j;
      continue;
    }
    const num = /^(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/.exec(rest);
    if (num) {
      tokens.push({ text: num[0], kind: "number", start: i, end: i + num[0].length });
      i += num[0].length;
      continue;
    }
    const word = /^[A-Za-z_][A-Za-z0-9_$]*/.exec(rest);
    if (word) {
      const text = word[0];
      tokens.push({
        text,
        kind: SQL_KEYWORDS.has(text.toLowerCase()) ? "keyword" : "word",
        start: i,
        end: i + text.length,
      });
      i += text.length;
      continue;
    }
    const op = OPERATORS.find((o) => rest.startsWith(o));
    if (op) {
      tokens.push({ text: op, kind: "op", start: i, end: i + op.length });
      i += op.length;
      continue;
    }
    tokens.push({ text: ch, kind: "punct", start: i, end: i + 1 });
    i++;
  }
  return tokens;
}

/** Comparable form of a token: case-folded words, numeric value for numbers. */
export function normToken(t: Token): string {
  switch (t.kind) {
    case "keyword":
    case "word":
      return t.text.toLowerCase();
    case "ident":
      return t.text.slice(1, t.unterminated ? undefined : -1).toLowerCase();
    case "number":
      return String(Number(t.text));
    case "op":
      return t.text === "<>" ? "!=" : t.text;
    default:
      return t.text;
  }
}

export type AlignOp =
  | { type: "match"; li: number; ri: number }
  | { type: "sub"; li: number; ri: number }
  /** Reference token `ri` is missing before learner token `li` (li may equal length). */
  | { type: "ins"; li: number; ri: number }
  /** Learner token `li` has no counterpart. */
  | { type: "del"; li: number };

export interface Alignment {
  ops: AlignOp[];
  cost: number;
}

/**
 * Edit-distance alignment of the learner's tokens against the reference's.
 * Trailing semicolons are ignored. Indices refer to the original token arrays.
 */
export function align(learner: Token[], reference: Token[]): Alignment {
  const keep = (ts: Token[]) =>
    ts.map((t, i) => ({ t, i })).filter(({ t }) => !(t.kind === "punct" && t.text === ";"));
  const a = keep(learner);
  const b = keep(reference);
  const n = a.length;
  const m = b.length;
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i]![0] = i;
  for (let j = 0; j <= m; j++) d[0]![j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const same = normToken(a[i - 1]!.t) === normToken(b[j - 1]!.t);
      d[i]![j] = Math.min(
        d[i - 1]![j - 1]! + (same ? 0 : 1),
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
      );
    }
  }
  const ops: AlignOp[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const here = d[i]![j]!;
    if (i > 0 && j > 0) {
      const same = normToken(a[i - 1]!.t) === normToken(b[j - 1]!.t);
      if (here === d[i - 1]![j - 1]! + (same ? 0 : 1)) {
        ops.push({ type: same ? "match" : "sub", li: a[i - 1]!.i, ri: b[j - 1]!.i });
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && here === d[i - 1]![j]! + 1) {
      ops.push({ type: "del", li: a[i - 1]!.i });
      i--;
    } else {
      const li = i < n ? a[i]!.i : learner.length;
      ops.push({ type: "ins", li, ri: b[j - 1]!.i });
      j--;
    }
  }
  ops.reverse();
  return { ops, cost: d[n]![m]! };
}

/** Damerau-Levenshtein distance (optimal string alignment). */
export function editDistance(x: string, y: string): number {
  const d: number[][] = Array.from({ length: x.length + 1 }, (_, i) =>
    Array.from({ length: y.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1]) {
        v = Math.min(v, d[i - 2]![j - 2]! + 1);
      }
      d[i]![j] = v;
    }
  }
  return d[x.length]![y.length]!;
}

/** If `t` looks like a misspelt keyword (FORM, SELEC, WHER), return the keyword. */
export function keywordTypo(t: Token | undefined, identifiers: ReadonlySet<string>): string | null {
  if (!t || t.kind !== "word" || t.text.length < 3) return null;
  const low = t.text.toLowerCase();
  if (identifiers.has(low)) return null;
  for (const kw of SQL_KEYWORDS) {
    if (kw.length >= 3 && editDistance(low, kw) === 1) return kw.toUpperCase();
  }
  return null;
}
