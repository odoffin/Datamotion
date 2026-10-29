export type GuardResult = { ok: true; sql: string } | { ok: false; error: string };

const FORBIDDEN = new Set([
  "insert", "update", "delete", "create", "drop", "alter", "attach", "detach",
  "copy", "pragma", "install", "load", "export", "import", "set", "reset",
  "call", "checkpoint", "vacuum", "truncate", "begin", "commit", "rollback",
  "grant", "revoke", "use", "merge",
]);

/**
 * Blanks out string literals, quoted identifiers and comments so that
 * keyword and semicolon checks only see real SQL tokens.
 */
function stripLiterals(sql: string): string | null {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === "-" && next === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      out += " ";
    } else if (ch === "/" && next === "*") {
      const end = sql.indexOf("*/", i + 2);
      if (end === -1) return null;
      i = end + 2;
      out += " ";
    } else if (ch === "'" || ch === '"') {
      let j = i + 1;
      for (;;) {
        if (j >= sql.length) return null;
        if (sql[j] === ch) {
          if (sql[j + 1] === ch) j += 2;
          else break;
        } else j++;
      }
      out += ch === "'" ? "''" : '""';
      i = j + 1;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

/** Allows exactly one SELECT or WITH statement (read-only sandbox). */
export function guardReadOnly(input: string): GuardResult {
  const stripped = stripLiterals(input);
  if (stripped === null) {
    return { ok: false, error: "There's an unclosed quote or comment in your query." };
  }
  const body = stripped.trim().replace(/;\s*$/, "").trim();
  if (body.length === 0) return { ok: false, error: "Write a query to run." };
  if (body.includes(";")) {
    return { ok: false, error: "Run one statement at a time." };
  }
  const first = body.match(/^[a-z_]+/i)?.[0]?.toLowerCase();
  if (first !== "select" && first !== "with") {
    return {
      ok: false,
      error: "Only SELECT (or WITH … SELECT) queries can run here. The data is read-only.",
    };
  }
  for (const word of body.toLowerCase().match(/[a-z_]+/g) ?? []) {
    if (FORBIDDEN.has(word)) {
      return {
        ok: false,
        error: `"${word.toUpperCase()}" isn't allowed here. The data is read-only.`,
      };
    }
  }
  return { ok: true, sql: input.trim().replace(/;\s*$/, "") };
}

/** Turns DuckDB error text into something a learner can act on. */
export function friendlyError(raw: string): string {
  const msg = raw.split("\n")[0]?.trim() ?? raw;
  const table = msg.match(/Table with name (\S+) does not exist/i);
  if (table) return `There's no table called ${table[1]} in this dataset.`;
  const column = msg.match(/Referenced column "?([^"\s]+)"? not found/i);
  if (column) return `There's no column called ${column[1]} here.`;
  const syntax = msg.match(/syntax error at or near "?([^"]*)"?/i);
  if (syntax) return `SQL syntax error near "${syntax[1]}".`;
  if (/syntax error at end of input/i.test(msg)) {
    return "The query ends too early. Is something missing?";
  }
  return msg.replace(/^[A-Za-z ]+Error:\s*/, "");
}
