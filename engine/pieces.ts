import { closingBracket, isPunct, isWord } from "./clauses";
import { lex, type Token } from "./lex";

/**
 * "Piece by piece": every word and mark of the learner's query with what it
 * means, in words a young child could follow. Lines are kept as written, so
 * the pieces sit under the line they come from.
 */
export interface Piece {
  text: string;
  meaning: string;
}

export interface PieceLine {
  /** The line as written. */
  code: string;
  pieces: Piece[];
}

/** Words of two or three parts that mean one thing. Longest first. */
const PHRASES: [string[], string][] = [
  [["is", "not", "null"], "has a value (it is not empty)"],
  [["not", "between"], "is outside this range"],
  [["union", "all"], "put the two lists one under the other, keeping repeats"],
  [["left", "outer", "join"], "join, and keep every row from the first table even when nothing matches"],
  [["group", "by"], "put rows that share a value into the same group"],
  [["order", "by"], "put the rows in order, sorted by"],
  [["partition", "by"], "split the rows into groups for this calculation, without merging them"],
  [["left", "join"], "join, and keep every row from the first table even when nothing matches"],
  [["right", "join"], "join, and keep every row from the second table even when nothing matches"],
  [["full", "join"], "join, and keep every row from both tables"],
  [["inner", "join"], "join, keeping only rows that match"],
  [["cross", "join"], "pair every row with every row of the other table"],
  [["is", "null"], "has no value (it is empty)"],
  [["not", "in"], "is not one of these"],
  [["not", "like"], "does not match this pattern"],
  [["not", "null"], "this column can never be empty"],
  [["primary", "key"], "this column names each row: no two rows may share it, and it is never empty"],
  [["create", "table"], "make a new table"],
  [["create", "view"], "save a query under a name"],
  [["create", "index"], "build a lookup that makes finding rows faster"],
  [["insert", "into"], "add new rows to a table"],
  [["delete", "from"], "remove rows from a table"],
];

const WORDS: Record<string, string> = {
  select: "choose what to show",
  distinct: "show each different value once (remove repeats)",
  from: "the table to read from",
  where: "only keep the rows that pass this test",
  having: "only keep the groups that pass this test",
  join: "put a second table next to the first",
  on: "how a row in one table finds its partner in the other",
  using: "match rows on a column both tables share",
  as: "give it a new name",
  and: "both tests must be true",
  or: "at least one of the tests must be true",
  not: "the opposite",
  in: "is one of these",
  between: "is in this range, both ends included",
  like: "matches a pattern of letters",
  ilike: "matches a pattern of letters, big or small",
  limit: "only keep this many rows",
  offset: "skip this many rows first",
  asc: "smallest first (A to Z)",
  desc: "biggest first (Z to A)",
  union: "put the two lists one under the other, removing repeats",
  except: "keep rows from the first list that are not in the second",
  intersect: "keep only rows found in both lists",
  with: "give a smaller query a name, to use below",
  case: "start of a choose-a-label rule",
  when: "if this is true",
  then: "use this label",
  else: "otherwise, use this label",
  end: "end of the choose-a-label rule",
  over: "work this out across nearby rows, without merging them",
  exists: "the smaller query finds at least one row",
  values: "here are the new rows",
  update: "change rows in a table",
  set: "the new value to write",
  delete: "remove rows",
  references: "must match a row in another table",
  unique: "no two rows may share this value",
  default: "the value to use when none is given",
  check: "a rule every row must pass",
  explain: "show how the database would run the query, instead of running it",
  null: "empty: no value at all",
  true: "yes",
  false: "no",
  integer: "a whole number",
  varchar: "text",
  double: "a number that can have a decimal point",
  date: "a date",
  boolean: "yes or no",
  table: "a table",
  view: "a saved query",
  index: "a lookup",
  key: "a key",
  into: "into",
  all: "keep them all",
};

const FUNCTIONS: Record<string, string> = {
  count: "count",
  sum: "add up",
  avg: "the average of",
  min: "the smallest of",
  max: "the biggest of",
  round: "round off a number",
  upper: "turn text into CAPITAL letters",
  lower: "turn text into small letters",
  length: "count the letters in",
  month: "the month number of a date",
  year: "the year of a date",
  coalesce: "use the first value that is not empty",
  row_number: "number the rows 1, 2, 3",
  rank: "give each row a place, like a race",
  dense_rank: "give each row a place, with no gaps after a tie",
};

const OPERATORS: Record<string, string> = {
  "=": "is equal to",
  "==": "is equal to",
  "!=": "is not equal to",
  "<>": "is not equal to",
  ">": "is more than",
  ">=": "is more than or equal to",
  "<": "is less than",
  "<=": "is less than or equal to",
  "+": "plus",
  "-": "minus",
  "/": "divided by",
  "%": "the remainder after dividing by",
  "||": "glue the text together",
  "::": "change the type to",
};

export interface PieceOptions {
  /** Tables the query may read, so a name can be told apart as a table or a column. */
  tables?: readonly { name: string; columns: readonly { name: string }[] }[];
}

const low = (t: Token | undefined) => t?.text.toLowerCase() ?? "";

/** The meaning of each piece, line by line. Never throws. */
export function piecesOf(sql: string, opts: PieceOptions = {}): PieceLine[] {
  try {
    const ts = lex(sql);
    const tables = new Set((opts.tables ?? []).map((t) => t.name.toLowerCase()));
    const columns = new Set((opts.tables ?? []).flatMap((t) => t.columns.map((c) => c.name.toLowerCase())));
    // Names given with AS (or straight after a table) are short names, not columns.
    const aliases = new Set<string>();
    ts.forEach((t, i) => {
      const prev = low(ts[i - 1]);
      const before = low(ts[i - 2]);
      if (t.kind !== "word") return;
      if (prev === "as") aliases.add(low(t));
      else if (["from", "join"].includes(before) && tables.has(prev)) aliases.add(low(t));
    });

    const pieces: (Piece & { start: number })[] = [];
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i]!;
      const add = (text: string, meaning: string) => pieces.push({ text, meaning, start: t.start });
      // Several words that mean one thing.
      const phrase = PHRASES.find(([words]) => words.every((w, k) => isWord(ts[i + k], w)));
      if (phrase) {
        add(ts.slice(i, i + phrase[0].length).map((x) => x.text).join(" "), phrase[1]);
        i += phrase[0].length - 1;
        continue;
      }
      if (isPunct(t, ";")) {
        add(";", "the end of the question, like a full stop at the end of a sentence");
        continue;
      }
      if (isPunct(t, ",")) {
        add(",", "and the next one (it separates the items of a list)");
        continue;
      }
      if (isPunct(t, ")") || isPunct(t, ".")) continue;
      if (isPunct(t, "(")) {
        const prev = ts[i - 1];
        const next = ts[i + 1];
        const close = closingBracket(ts, i);
        const inside = close > i + 1;
        add(
          "( )",
          isWord(next, "select") || isWord(next, "with")
            ? "a smaller query inside the brackets, worked out first"
            : low(prev) === "in"
              ? "the brackets hold the list to look in"
              : low(prev) === "values"
                ? "one new row, its values in order"
                : prev && (prev.kind === "word" || prev.kind === "keyword") && FUNCTIONS[low(prev)] !== undefined
                  ? inside
                    ? "the brackets hold what it works on"
                    : "nothing goes inside these brackets"
                  : "keep this part together",
        );
        continue;
      }
      if (t.kind === "string") {
        add(
          t.text,
          `a piece of text: ${t.text.slice(1, -1)}. The quote marks show where the text starts and stops, so the database knows it is words, not a column name`,
        );
        continue;
      }
      if (t.kind === "number") {
        add(t.text, `the number ${t.text}`);
        continue;
      }
      if (t.kind === "op") {
        if (t.text === "*") {
          const prev = ts[i - 1];
          add(
            "*",
            isPunct(prev, "(")
              ? "every row"
              : isWord(prev, "select") || isPunct(prev, ",") || isPunct(prev, ".") || isWord(prev, "distinct")
                ? "every column"
                : "times (multiply)",
          );
        } else if (OPERATORS[t.text]) add(t.text, OPERATORS[t.text]!);
        continue;
      }
      if (t.kind === "keyword" || t.kind === "word" || t.kind === "ident") {
        const w = low(t);
        // A name with a table in front: o.amount is "the amount column of o".
        if (isPunct(ts[i + 1], ".") && ts[i + 2] && ts[i + 2]!.kind !== "op") {
          const col = ts[i + 2]!.text;
          add(`${t.text}.${col}`, `the ${col} column of ${aliases.has(w) ? `the table called ${t.text}` : `the ${t.text} table`}`);
          i += 2;
          continue;
        }
        if (isPunct(ts[i + 1], "(") && FUNCTIONS[w] !== undefined) {
          add(t.text, FUNCTIONS[w]!);
          continue;
        }
        if (t.kind === "keyword" && WORDS[w]) {
          add(t.text, WORDS[w]!);
          continue;
        }
        if (WORDS[w] && t.kind === "word" && ["integer", "varchar", "double", "date", "boolean"].includes(w)) {
          add(t.text, WORDS[w]!);
          continue;
        }
        const prev = low(ts[i - 1]);
        const before = low(ts[i - 2]);
        const tableBefore = (k: number) => tables.has(low(ts[i - k])) && ["from", "join"].includes(low(ts[i - k - 1]));
        if (prev === "as") add(t.text, tableBefore(2) ? `a short name for the ${before} table` : `a new name for this column: ${t.text}`);
        else if (["from", "join"].includes(prev)) add(t.text, tables.has(w) ? `the ${t.text} table` : `the table (or named step) called ${t.text}`);
        else if (tableBefore(1)) add(t.text, `a short name for the ${prev} table`);
        else if (["table", "into", "update", "view", "index"].includes(prev)) add(t.text, `the name of the table: ${t.text}`);
        else if (columns.has(w)) add(t.text, `the ${t.text} column`);
        else if (aliases.has(w)) add(t.text, `the name given earlier with AS: ${t.text}`);
        else if (tables.has(w)) add(t.text, `the ${t.text} table`);
        else if (WORDS[w]) add(t.text, WORDS[w]!);
        else add(t.text, `a name: ${t.text}`);
      }
    }

    // Group the pieces under the line they start on, one of each per line.
    const lines: PieceLine[] = [];
    let at = 0;
    for (const code of sql.split("\n")) {
      const start = at;
      at += code.length + 1;
      const own = pieces.filter((p) => p.start >= start && p.start < at);
      if (!code.trim() || !own.length) continue;
      const seen = new Set<string>();
      lines.push({
        code: code.trimEnd(),
        pieces: own.flatMap(({ text, meaning }) => {
          const key = `${text.toLowerCase()}|${meaning}`;
          if (seen.has(key)) return [];
          seen.add(key);
          return [{ text, meaning }];
        }),
      });
    }
    return lines;
  } catch {
    return [];
  }
}

/** Said once, above the pieces: the layout is for people, not for the database. */
export const SPACING_NOTE =
  "The new lines and spaces are only there to make the query easy to read, like lines in a notebook. The database reads it the same either way. Words in capitals, like SELECT, are SQL's own words; the rest are your table and column names.";

/** The whole query as one sentence, from the first sentence of each step in run order. */
export function inPlainWords(sentences: readonly string[]): string {
  const firsts = sentences.map((s) => s.split(/(?<=\.)\s/)[0]!.replace(/\.$/, ""));
  const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0]!.toLowerCase() + s.slice(1) : s);
  return firsts.length ? `${firsts.map((s, i) => (i === 0 ? s : lowerFirst(s))).join(", then ")}.` : "";
}
