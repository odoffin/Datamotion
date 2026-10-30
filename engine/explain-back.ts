import { closingBracket, depths, isPunct, isWord, parseWith, splitClauses, splitTop, textOf, type Clause } from "./clauses";
import { kinds, parseJoin, tableRef } from "./explain";
import { lex, type Token } from "./lex";
import { andList, conditionPhrase, hasAggregate, sortItems, type PhraseContext } from "./phrase";
import type { QueryResult } from "./query-runner";
import { splitStatements } from "./sandbox";

/**
 * "Explain it back": after a query is approved, the learner finishes one
 * sentence about it by choosing among three endings. Structured prompts like
 * this help more than an open "explain your code" box, and learners seldom
 * explain code to themselves unprompted. The question is built from the
 * learner's own query, about the part of it the lesson is most likely about.
 */
export interface ExplainBackQuestion {
  /** The start of the sentence, e.g. "Your query keeps a row only if". */
  prompt: string;
  options: string[];
  answer: number;
  /** Why the right ending is right, said once the learner has it. */
  why: string;
}

interface Draft {
  prompt: string;
  right: string;
  wrong: string[];
  why: string;
}

const unquote = (s: string) => s.replace(/^"(.*)"$/, "$1");

/** The same order every time for a given seed. */
function shuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h ^= h >>> 13;
    const j = (h >>> 0) % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const SWAPS: Record<string, string[]> = {
  ">": [">=", "<"],
  ">=": [">", "<"],
  "<": ["<=", ">"],
  "<=": ["<", ">"],
  "!=": ["=", ">"],
  "<>": ["=", ">"],
};

/**
 * Near-miss versions of a condition, each a different meaning: > for >=,
 * AND for OR, a LIKE pattern moved, IS NOT NULL for IS NULL and so on.
 */
function nearMisses(sql: string, cond: Token[]): string[] {
  const text = textOf(sql, cond);
  const base = cond[0]!.start;
  const at = (t: Token) => t.start - base;
  const swap = (start: number, end: number, by: string) => text.slice(0, start) + by + text.slice(end);
  const d = depths(cond);
  const out: string[] = [];
  let betweenOpen = false;
  cond.forEach((t, i) => {
    if (d[i] !== 0) return;
    const next = cond[i + 1];
    if (t.kind === "op" && SWAPS[t.text]) for (const alt of SWAPS[t.text]!) out.push(swap(at(t), t.end - base, alt));
    if (t.kind === "op" && (t.text === "=" || t.text === "==")) {
      out.push(swap(at(t), t.end - base, "!="));
      if (next?.kind === "number") out.push(swap(at(t), t.end - base, ">"));
      if (next?.kind === "string") out.push(swap(at(t), next.end - base, `LIKE '%${next.text.slice(1, -1)}%'`));
    }
    if (isWord(t, "between")) {
      betweenOpen = true;
      if (!isWord(cond[i - 1], "not")) out.push(swap(at(t), t.end - base, "NOT BETWEEN"));
      const low = cond[i + 1];
      const high = cond[i + 3];
      const lhs = textOf(sql, cond.slice(0, isWord(cond[i - 1], "not") ? i - 1 : i));
      if (low && high && isWord(cond[i + 2], "and")) out.push(swap(0, high.end - base, `${lhs} > ${low.text} AND ${lhs} < ${high.text}`));
    }
    if (isWord(t, "or")) out.push(swap(at(t), t.end - base, "AND"));
    if (isWord(t, "and")) {
      if (betweenOpen) betweenOpen = false;
      else out.push(swap(at(t), t.end - base, "OR"));
    }
    if ((isWord(t, "like") || isWord(t, "ilike")) && next?.kind === "string") {
      const core = next.text.slice(1, -1).replace(/^%|%$/g, "");
      for (const p of [`'%${core}'`, `'%${core}%'`, `'${core}%'`]) out.push(swap(at(next), next.end - base, p));
    }
    if (next && isWord(t, "is") && isWord(next, "null")) {
      out.push(swap(at(t), next.end - base, "IS NOT NULL"));
      out.push(swap(at(t), next.end - base, "= 'NULL'"));
    }
    if (isWord(t, "is") && isWord(next, "not") && isWord(cond[i + 2], "null")) out.push(swap(at(t), cond[i + 2]!.end - base, "IS NULL"));
    if (isWord(t, "in") && !isWord(cond[i - 1], "not")) out.push(swap(at(t), t.end - base, "NOT IN"));
  });
  return out;
}

function conditionDraft(ctx: PhraseContext, cond: Token[], prompt: string, why: string): Draft | null {
  const right = conditionPhrase(ctx, cond);
  const wrong: string[] = [];
  for (const variant of nearMisses(ctx.sql, cond)) {
    const phrase = conditionPhrase({ ...ctx, sql: variant }, lex(variant));
    if (phrase !== right && !wrong.includes(phrase) && !phrase.startsWith("this is")) wrong.push(phrase);
    if (wrong.length === 2) break;
  }
  if (wrong.length < 2) return null;
  const text = textOf(ctx.sql, cond);
  const notes = [
    /[<>](?!=)/.test(text) && "> and < leave the number itself out; >= and <= keep it.",
    /\bbetween\b/i.test(text) && "BETWEEN includes both ends.",
    /\blike\b/i.test(text) && "In a LIKE pattern, % stands for any run of characters.",
    /\bis\s+(not\s+)?null\b/i.test(text) && "NULL means the value is missing; it is not the text 'NULL'.",
    /\bor\b/i.test(text) && "OR keeps a row when either test passes; AND needs both.",
  ].filter(Boolean);
  return { prompt, right, wrong, why: [why, ...notes].join(" ") };
}

/** The statements that change data or describe something: one question each kind. */
function statementDraft(sql: string): Draft | null {
  const ts = lex(sql).filter((t) => !isPunct(t, ";"));
  const d = depths(ts);
  const w = (i: number) => ts[i]?.text.toLowerCase() ?? "";
  const top = (word: string) => ts.findIndex((t, i) => d[i] === 0 && isWord(t, word));
  const name = (i: number) => (ts[i] ? unquote(ts[i]!.text) : "");

  if (w(0) === "explain") {
    return {
      prompt: "EXPLAIN gives you",
      right: "DuckDB's plan for running the query, not its rows",
      wrong: ["the query's rows, sorted", "the number of rows the query returns"],
      why: "EXPLAIN describes the steps the database would take. To get the rows, run the query without it.",
    };
  }
  if (w(0) === "create") {
    const kindAt = ts.findIndex((t) => ["table", "view", "index"].includes(t.text.toLowerCase()));
    const kind = w(kindAt);
    const what = name(kindAt + 1);
    if (kind === "view") {
      return {
        prompt: `Reading ${what} later shows`,
        right: "the query run again on the rows as they are then",
        wrong: ["the rows as they were when the view was made", "nothing until you INSERT rows into it"],
        why: "A view stores the query, not its rows, so it always reflects the current data.",
      };
    }
    if (kind === "index") {
      const onAt = top("on");
      return {
        prompt: `After CREATE INDEX, the rows of ${name(onAt + 1)}`,
        right: "are exactly the same; only lookups get faster",
        wrong: ["are sorted for good by the indexed column", "lose any repeated values in that column"],
        why: "An index is a separate lookup structure. It never changes the rows themselves.",
      };
    }
    if (kind === "table" && top("as") > kindAt) {
      return {
        prompt: `The new ${what} table starts with`,
        right: "the rows the query after AS returns",
        wrong: ["no rows, only the column names", "every row and column of the table the query reads"],
        why: "CREATE TABLE … AS fills the new table with the query's result in one go.",
      };
    }
    if (kind === "table") {
      const pk = ts.findIndex((t) => isWord(t, "primary"));
      const ref = ts.findIndex((t) => isWord(t, "references"));
      const columnBefore = (i: number) => {
        let j = i;
        while (j > 0 && !isPunct(ts[j - 1], ",") && !isPunct(ts[j - 1], "(")) j--;
        return name(j);
      };
      if (ref > 0) {
        const col = columnBefore(ref);
        const target = name(ref + 1);
        return {
          prompt: `Adding a ${what} row whose ${col} matches no row in ${target}`,
          right: "is refused",
          wrong: [`is added, with ${col} set to NULL`, `adds the missing ${target} row as well`],
          why: `REFERENCES means every ${col} must point at a row that exists in ${target}, so the database refuses one that does not.`,
        };
      }
      if (pk > 0) {
        const col = columnBefore(pk);
        return {
          prompt: `Adding a second row with the same ${col}`,
          right: "is refused",
          wrong: ["replaces the first row", "is added, so two rows share it"],
          why: `PRIMARY KEY makes ${col} unique and never empty, so each value names exactly one row.`,
        };
      }
      return {
        prompt: `Right after CREATE TABLE, ${what} holds`,
        right: "no rows yet, only its columns",
        wrong: ["one empty row", "a copy of the rows of another table"],
        why: "CREATE TABLE describes the columns. Rows arrive later, with INSERT.",
      };
    }
  }
  if (w(0) === "insert") {
    const valuesAt = top("values");
    if (valuesAt < 0) return null;
    const n = splitTop(ts.slice(valuesAt + 1), (t) => isPunct(t, ",")).length;
    const rows = (k: number) => `${k} new row${k === 1 ? "" : "s"}`;
    return {
      prompt: "This statement adds",
      right: rows(n),
      wrong: [`${n} new column${n === 1 ? "" : "s"}`, rows(n === 1 ? 2 : 1)],
      why: "Each bracketed group after VALUES is one new row.",
    };
  }
  if (w(0) === "update" || w(0) === "delete") {
    const table = w(0) === "update" ? name(1) : name(top("from") + 1);
    const hasWhere = top("where") > 0;
    if (!hasWhere) {
      return {
        prompt: `Without a WHERE, ${w(0).toUpperCase()} affects`,
        right: `every row of ${table}`,
        wrong: ["only the first row", "no rows at all"],
        why: "WHERE is what limits the rows. Leave it out and every row is changed.",
      };
    }
    return {
      prompt: `Rows of ${table} where the WHERE test fails`,
      right: "stay exactly as they were",
      wrong: w(0) === "update" ? ["are deleted", "get the new value too"] : ["are deleted too", "are kept, but emptied"],
      why: `${w(0).toUpperCase()} only touches the rows its WHERE picks. Every other row is left alone.`,
    };
  }
  return null;
}

const AGGREGATE_NAMES = new Set(["count", "sum", "avg", "min", "max"]);

/** Builds the question for a SELECT: the rarest construct in it wins, since that is most likely the lesson. */
function queryDraft(sql: string, result: QueryResult | null | undefined): Draft | null {
  const clauses = splitClauses(sql);
  const withClause = clauses[0]?.kind === "with" ? clauses[0] : null;
  const body = withClause ? clauses.slice(1) : clauses;
  const of = (kind: Clause["kind"]) => body.filter((c) => c.kind === kind);
  const ctx: PhraseContext = { sql, kindOf: kinds(result) };
  const select = of("select")[0];
  const selectTokens = select?.tokens.slice(1) ?? [];
  const from = of("from")[0];
  const table = from ? tableRef(sql, from.tokens.slice(1)).name : "the table";
  const where = of("where")[0];
  const group = of("group")[0];
  const having = of("having")[0];
  const joins = of("join");
  const order = of("order")[0];
  const limit = of("limit")[0];

  const set = of("set")[0];
  if (set) {
    const words = set.tokens.map((t) => t.text.toLowerCase());
    if (words[0] === "union") {
      const all = words.includes("all");
      return {
        prompt: "A row that both queries return comes out",
        right: all ? "twice" : "once",
        wrong: all ? ["once", "not at all"] : ["twice", "not at all"],
        why: all ? "UNION ALL keeps every row, repeats included." : "UNION stacks the two lists, then removes repeated rows.",
      };
    }
    return words[0] === "except"
      ? {
          prompt: "A row that both queries return",
          right: "is left out",
          wrong: ["comes out once", "comes out twice"],
          why: "EXCEPT keeps the first list's rows that the second list does not have.",
        }
      : {
          prompt: "A row that only the first query returns",
          right: "is left out",
          wrong: ["comes out once", "comes out twice"],
          why: "INTERSECT keeps only the rows both lists have.",
        };
  }

  if (withClause) {
    const name = parseWith(sql, withClause)[0]?.name ?? "the named step";
    return {
      prompt: `In this query, ${name} is`,
      right: "worked out first, then read like a table by the query below it",
      wrong: ["a new table saved in the database for good", "worked out again for every row of the query below it"],
      why: "WITH gives a step a name. It exists only while this query runs.",
    };
  }

  if (where) {
    const ts = where.tokens;
    const open = ts.findIndex((t, i) => isPunct(t, "(") && isWord(ts[i + 1], "select"));
    if (open > 0 && isWord(ts[open - 1], "in")) {
      const lhs = textOf(sql, ts.slice(1, isWord(ts[open - 2], "not") ? open - 2 : open - 1));
      return {
        prompt: "The inner query in brackets gives WHERE",
        right: `a list of values to look each ${lhs} up in`,
        wrong: ["one number to compare every row with", "a new table saved in the database"],
        why: "With IN, the inner query builds the list first; WHERE then keeps the rows whose value is in it.",
      };
    }
    if (open > 0) {
      return {
        prompt: "The inner query in brackets runs",
        right: "once, before WHERE tests any row, and gives one value",
        wrong: ["after WHERE has finished with every row", "once for every column of the table"],
        why: "WHERE looks at one row at a time, so the average is worked out first and handed to it as a single number.",
      };
    }
  }

  const windowAt = selectTokens.findIndex((t) => isWord(t, "over"));
  if (windowAt > 2) {
    // The function's own brackets end right before OVER.
    const close = windowAt - 1;
    let open = close;
    for (let depth = 0; open >= 0; open--) {
      if (isPunct(selectTokens[open], ")")) depth++;
      if (isPunct(selectTokens[open], "(") && --depth === 0) break;
    }
    const fn = selectTokens[open - 1]?.text.toLowerCase() ?? "";
    const arg = textOf(sql, selectTokens.slice(open + 1, close));
    const overOpen = windowAt + 1;
    const over = selectTokens.slice(overOpen + 1, closingBracket(selectTokens, overOpen));
    const partitioned = over.some((t) => isWord(t, "partition"));
    const orderAt = over.findIndex((t) => isWord(t, "order"));
    const orderBy = orderAt >= 0 ? sortItems(ctx, over.slice(orderAt + 2))[0]?.expr ?? "" : "";
    if (fn === "rank" || fn === "dense_rank") {
      return {
        prompt: `Two rows with the same ${orderBy || "value"}`,
        right: "get the same rank",
        wrong: ["get different ranks, in table order", "are both left out"],
        why: fn === "rank" ? "RANK gives ties the same place, then skips the places they used up." : "DENSE_RANK gives ties the same place, with no gap after them.",
      };
    }
    if (fn === "sum" && orderAt >= 0) {
      return {
        prompt: "On each row, the running total is",
        right: `the sum of ${arg} on that row and every row before it`,
        wrong: [`that row's ${arg} alone`, `the total of the whole ${arg} column`],
        why: `With ORDER BY inside OVER, SUM adds up the rows so far, in ${orderBy} order.`,
      };
    }
    return {
      prompt: `Compared with GROUP BY, ${fn.toUpperCase()}() OVER (…)`,
      right: partitioned ? "keeps every row and numbers it inside its group" : "keeps every row and numbers it",
      wrong: ["merges each group into one row", partitioned ? "numbers every row from 1 to the end, ignoring the groups" : "drops rows that share a value"],
      why: "A window function works out a value for each row from the rows around it, without merging them.",
    };
  }

  const caseAt = selectTokens.findIndex((t) => isWord(t, "case"));
  if (caseAt >= 0 && isWord(selectTokens[caseAt + 1], "when")) {
    const ts = selectTokens.slice(caseAt);
    const thenAt = ts.findIndex((t) => isWord(t, "then"));
    const elseAt = ts.findIndex((t) => isWord(t, "else"));
    const test = ts.slice(2, thenAt);
    const op = test.findIndex((t) => t.kind === "op" && [">", ">=", "<", "<=", "="].includes(t.text));
    const n = test[op + 1];
    if (op > 0 && n?.kind === "number" && test.length === op + 2 && elseAt > thenAt) {
      const col = textOf(sql, test.slice(0, op));
      const yes = ts[thenAt + 1]!.text;
      const no = ts[elseAt + 1]!.text;
      const passes = [">=", "<=", "="].includes(test[op]!.text);
      return {
        prompt: `A row whose ${col} is exactly ${n.text} gets the label`,
        right: passes ? yes : no,
        wrong: [passes ? no : yes, "NULL"],
        why: `${col} ${test[op]!.text} ${n.text} is ${passes ? "true" : "false"} when ${col} is exactly ${n.text}, so the ${passes ? "WHEN" : "ELSE"} label applies.`,
      };
    }
  }

  if (having) {
    const draft = conditionDraft(
      { ...ctx, grouped: true },
      having.tokens.slice(1),
      "Your query keeps a group only if",
      "HAVING tests each group after GROUP BY, so it can use totals and counts.",
    );
    if (draft) return draft;
  }

  if (group) {
    const keys = splitTop(group.tokens.slice(2), (t) => isPunct(t, ",")).map((p) => textOf(sql, p));
    return {
      prompt: "One row comes out for each",
      right: keys.length === 1 ? `different ${keys[0]}` : `different combination of ${andList(keys)}`,
      wrong: [`row of ${table}`, "column in the SELECT list"],
      why: "GROUP BY gathers rows with the same value into one group, and the result has one row per group.",
    };
  }

  const join = joins[joins.length - 1];
  if (join) {
    const j = parseJoin(sql, join);
    const base = from ? tableRef(sql, from.tokens.slice(1)) : null;
    // A table joined to itself is told apart by its short names.
    const self = base?.name.toLowerCase() === j.name.toLowerCase();
    const leftName = self && base?.alias ? `${base.alias} (${base.name})` : table;
    const target = self ? (j.alias ?? j.name) : j.name;
    const kept = j.kind === "left" || j.kind === "full";
    const left = `stays, with NULL in the ${target} columns`;
    return {
      prompt: `A row of ${leftName} that matches no row of ${target}`,
      right: kept ? left : "is left out of the result",
      wrong: [kept ? "is left out of the result" : left, `is paired with every row of ${target}`],
      why: kept ? "LEFT JOIN keeps every row of the table on its left, matched or not." : "A plain JOIN keeps only rows that find a match on both sides.",
    };
  }

  if (isWord(selectTokens[0], "distinct")) {
    const cols = textOf(sql, selectTokens.slice(1));
    return {
      prompt: `A ${cols} value that appears in several rows comes out`,
      right: "once",
      wrong: ["once for every row it appears in", "not at all"],
      why: "DISTINCT removes repeated rows from the result.",
    };
  }

  if (hasAggregate(selectTokens)) {
    return {
      prompt: "This query returns",
      right: "one row",
      wrong: [`one row for each row of ${table}`, "no rows, only a total"],
      why: "Without GROUP BY, a total like COUNT or SUM turns all the rows into a single row.",
    };
  }

  if (where) {
    const draft = conditionDraft(ctx, where.tokens.slice(1), "Your query keeps a row only if", "WHERE keeps a row only when its test is true for that row.");
    if (draft) return draft;
  }

  if (limit) {
    const n = textOf(sql, limit.tokens.slice(1));
    return {
      prompt: `LIMIT ${n} keeps`,
      right: order ? `the first ${n} rows, after ORDER BY has sorted them` : `the first ${n} rows the query produces`,
      wrong: [`${n} rows picked at random`, `the rows whose id is ${n} or less`],
      why: "LIMIT runs last and keeps rows from the top, so the order you sort by decides which rows those are.",
    };
  }

  if (order) {
    const items = sortItems(ctx, order.tokens.slice(2));
    const flip = (phrase: string) =>
      phrase.replace(/(smallest|largest|earliest|latest|lowest|highest) first|A to Z|Z to A/, (m) =>
        ({ "smallest first": "largest first", "largest first": "smallest first", "earliest first": "latest first", "latest first": "earliest first", "lowest first": "highest first", "highest first": "lowest first", "A to Z": "Z to A", "Z to A": "A to Z" })[m] ?? m,
      );
    const inTurn = (phrases: string[]) => phrases.join(", then ");
    const right = inTurn(items.map((i) => i.phrase));
    const wrong =
      items.length > 1
        ? [inTurn([...items].reverse().map((i) => i.phrase)), inTurn(items.map((i) => flip(i.phrase)))]
        : [flip(right), `the order the rows were added to ${table}`];
    return {
      prompt: "The rows come out sorted by",
      right,
      wrong,
      why: items.length > 1 ? "The first ORDER BY item sorts; the next only breaks ties." : "ASC (the default) sorts low to high; DESC sorts high to low.",
    };
  }

  const items = splitTop(selectTokens, (t) => isPunct(t, ","));
  for (const item of items) {
    const name = item[0]?.text.toLowerCase() ?? "";
    if (!isPunct(item[1], "(") || AGGREGATE_NAMES.has(name)) continue;
    if (name === "upper" || name === "lower") {
      const col = result?.columns.findIndex((c) => c.toLowerCase() === (isWord(item[item.length - 2], "as") ? item[item.length - 1]!.text.toLowerCase() : ""));
      const sampleValue = col !== undefined && col >= 0 ? result?.rows[0]?.[col] : undefined;
      if (typeof sampleValue === "string") {
        const plain = sampleValue.charAt(0).toUpperCase() + sampleValue.slice(1).toLowerCase();
        return {
          prompt: `${name.toUpperCase()}() turns ${plain} into`,
          right: name === "upper" ? plain.toUpperCase() : plain.toLowerCase(),
          wrong: name === "upper" ? [plain.toLowerCase(), plain] : [plain.toUpperCase(), plain],
          why: `${name.toUpperCase()} changes every letter to ${name === "upper" ? "a capital" : "a small letter"}; the value in the table stays as it was.`,
        };
      }
    }
    if (name === "round") {
      const args = splitTop(item.slice(2, closingBracket(item, 1)), (t) => isPunct(t, ","));
      const places = args[1] ? textOf(sql, args[1]) : "0";
      return {
        prompt: `ROUND(…, ${places}) keeps`,
        right: `${places} decimal place${places === "1" ? "" : "s"}`,
        wrong: [`${places} digits in total`, `the first ${places} rows`],
        why: "The second number in ROUND is how many digits to keep after the decimal point.",
      };
    }
  }
  if (selectTokens.some((t) => t.kind === "op" && t.text === "||")) {
    return {
      prompt: "The || signs",
      right: "join the pieces into one piece of text",
      wrong: ["add the values up as numbers", "mean OR, as in many other languages"],
      why: "In SQL, || glues text together. OR is written as the word OR.",
    };
  }

  const aliased = items.find((p) => p.length === 3 && isWord(p[1], "as"));
  if (aliased) {
    const [col, , alias] = aliased;
    return {
      prompt: `In the result, the ${col!.text} column is called`,
      right: unquote(alias!.text),
      wrong: [col!.text, `${col!.text} AS ${unquote(alias!.text)}`],
      why: "AS renames a column in the result only. The table keeps its own column name.",
    };
  }

  if (items.length === 1 && textOf(sql, items[0]!) === "*") {
    return {
      prompt: "SELECT * shows",
      right: `every column of ${table}`,
      wrong: [`only the first column of ${table}`, "the column names, with no rows"],
      why: "* means all the columns. Every row comes back too, because there is no WHERE.",
    };
  }
  if (items.length >= 1) {
    const cols = items.map((p) => textOf(sql, p));
    return {
      prompt: "The result has",
      right: `${cols.length} column${cols.length === 1 ? "" : "s"}: ${andList(cols)}`,
      wrong: [`every column of ${table}`, `only ${cols[0]}`],
      why: "SELECT lists exactly the columns you get back, in that order.",
    };
  }
  return null;
}

/** The question for a query, or null when none of the rules fit it. Never throws. */
export function explainBack(sql: string, seed: string, result?: QueryResult | null): ExplainBackQuestion | null {
  try {
    const statements = splitStatements(sql) ?? [{ text: sql.trim(), start: 0 }];
    const main = statements[statements.length - 1];
    if (!main) return null;
    const isQuery = /^\s*(select|with)\b/i.test(main.text);
    const draft = isQuery ? queryDraft(main.text, result) : statementDraft(main.text);
    if (!draft) return null;
    const options = shuffle([draft.right, ...draft.wrong.slice(0, 2)], seed);
    if (new Set(options).size !== 3) return null;
    return { prompt: draft.prompt, options, answer: options.indexOf(draft.right), why: draft.why };
  } catch {
    return null;
  }
}
