# BUILD PHASE 2: the main flow

Read first, in this order: AGENTS.md (Next.js 16 notes; check node_modules/next/dist/docs before using any
Next API you are not certain of), DESIGN.md (locked look), then the three files in design/reference/.
You are extending the working app from steps 1 to 3 (DuckDB runner, Trace types, Filter scene, playback bar).
Do not rewrite what works. Reuse engine/, content/datasets/ and the playback code.

## The flow to build
Placement quiz (optional) -> Chapter map (start anywhere) -> Lesson (type real SQL, run it, watch it, get
wrong syntax pointed at, fade the code away when comfortable) -> next lesson.

## Rules
- Work in the current folder. One git commit per step with a clear message. Do NOT push.
- After each step run: npm run lint, npm run typecheck, npm test, and (from step 4 on) npm run build. All must pass.
- Do not add any dependency without asking me first. Everything below is doable with what is installed.
- Never print, log or commit secrets. Only the publishable Supabase key exists in .env.local. Do not call Supabase yet.
- `.claude/skills/` is third-party text and is already in .gitignore. Never commit it. `design/` and DESIGN.md are ours and should be committed.
- TypeScript strict, no `any`. No literal colours outside the token block in globals.css.
- Stop after Step 7 and report. Do not start the sandbox or auth.

## Step 4: Ledger design system and shell
1. Implement the tokens from DESIGN.md in app/globals.css (Tailwind v4 @theme + CSS variables).
2. lib/fonts.ts exports the next/font setup (Fraunces, IBM Plex Mono, Caveat, Inter). layout.tsx uses it. One place to swap fonts later.
3. Build shared components in components/ledger/: Header (wordmark from lib/brand.ts, links Chapters, Review, My progress),
   Slip, LedgerSheet, LedgerRow, Button (solid | line), MarginNote (Caveat), Disclosure ("Read the long version").
4. Restyle the existing Filter lesson page to the Ledger look using these components. Keep everything functional.
5. Responsive check at 1440, 900 and 360 widths: no horizontal scroll, columns wrap, targets 44px+.

## Step 5: Free typing, real checking, error pointing
Learners type any SQL. Do not compare tokens against one fixed query; check the RESULT.
1. content/lessons/types.ts: extend Lesson with `goal: { description: string; referenceSql: string; compare: 'rows-any-order' | 'rows-ordered' }`,
   `starterSql` (the filter lesson starts with the deliberate typo `SELECT * FORM orders WHERE amount > 50`),
   `explanation: { short: string; long: string[] }`, `hints: string[]` and `nextLessonId?: string`.
2. engine/check.ts (pure, unit-tested with the Node DuckDB runner):
   - `parseCheck(sql)`: use DuckDB `json_serialize_sql` through the QueryRunner (escape quotes properly; the sql guard still applies).
     On a syntax error return `{ kind: 'syntax', message, position? }`. DuckDB reports the error position; use it.
   - `locateErrorToken(sql, error)`: lex the learner's text into tokens with offsets (words, numbers, operators, strings, punctuation).
     Resolution order: (a) the token containing the error position; (b) a quoted identifier named in the error message
     (e.g. Referenced column "amout" not found) matched against tokens; (c) the first token that differs when the learner's query is aligned
     with referenceSql (token diff); (d) none, then highlight the whole statement. Return the token index.
   - `expectedHint(sql, referenceSql, tokenIndex)`: if aligning with the reference suggests a single replacement, return `expected FROM`; otherwise a plain
     message from DuckDB, rewritten in friendly words ("did you mean ..." when DuckDB offers a candidate).
   - `checkAnswer(sql, lesson, runner)`: run learner SQL and referenceSql; compare columns and rows (order-insensitive unless compare is 'rows-ordered';
     compare values after normalising numbers). Return `{ ok, reason }` with reasons like 'wrong row count', 'extra column', 'rows differ' and a hint
     that does not reveal the answer.
   - Tests: at least 15 cases: each typo class (keyword typo, missing keyword, unknown column, unknown table, missing operand, extra text, unbalanced quote),
     correct alternatives that must pass (different spacing, lowercase, `amount > 50` written as `50 < amount`), a correct-looking query that returns
     different rows (>= instead of >), and an empty query.
3. components/lesson/QueryEditor.tsx: CodeMirror 6, multi-line, SQL highlighting using the Ledger tokens (keywords --key, numbers --num).
   Enter runs (Shift+Enter inserts a newline). Run and Start over buttons.
4. components/lesson/DiagnosticStrip.tsx, per DESIGN.md: shows the learner's tokens, circles the wrong one in --pen, shakes it
   (alternate two keyframe names each failed run), and shows a Caveat note ("expected FROM") directly under it with role="alert".
   Reduced motion: no shake, the circle and note still appear.
5. Success state per design: "Approved. The ledger below shows what survived." with two buttons:
   "I've got it, fade the code" and "Show me once more". Fade follows DESIGN.md Motion.

## Step 6: Trace the learner's own query
1. engine/scenes/filter.ts: today it builds a trace from slots. Make it work from the learner's SQL.
   Use `json_serialize_sql` to get the AST. Supported shape: a single base table, optional WHERE, any select list.
   Build the instrumented query by modifying the AST (set the select list to `rowid AS _rid` and the WHERE expression as a `keep` column,
   remove the WHERE) and turn it back to SQL with `json_deserialize_sql`. Never build SQL by concatenating the learner's strings.
2. Unsupported shapes (joins, subqueries, aggregates for now): do not fail. Show a clearly labelled simpler before/after animation using the real result row ids,
   with a banner: "This query shape does not have a step-by-step animation yet."
3. Keep the existing step design (scan in batches, keep or drop, boundary narration that depends on the operator). The animated final row ids must equal the real result row ids; assert this in tests for at least 8 typed queries, including `>=`, `<`, `=`, `BETWEEN`, `AND`, `OR` and `NOT`.
4. The LedgerSheet shows the animation as rows with verdicts (kept with check icon, dropped struck through with x icon), the count line, and an aria-live narration.
5. PlaybackBar stays as built. Reduced motion starts paused with step-through.

## Step 7: Chapters, placement and the flow
1. content/chapters.ts: the 12 chapters, exactly as in design/reference/Map.dc.html (names, topics, blurbs, sample, prerequisites, margin notes, groups).
   Soft prerequisites only; never block a learner from starting anywhere.
2. lib/placement.ts (pure, tested): port the six questions and the recommendation logic from design/reference/Placement.dc.html. The quiz can be skipped.
   Honest caveat text when chapters between levels were not tested.
3. Routes: `/` (short welcome with two buttons: Take the placement quiz, Browse the chapters), `/placement`, `/chapters`, `/lesson/[id]` (generalise the current /lesson/filter; keep /lesson/filter working).
   Port the Map and Placement screens from the reference files with the Ledger components.
4. store/progress.ts (zustand with persist to localStorage key `dm.progress.v1`, wrapped in try/catch so the app works without storage):
   placement result, per-lesson status (not started, in progress, done), `knownChapters` (tested out), last lesson, and when a lesson was finished.
   The Map shows real status from this store instead of demo data. Statuses are words plus icons, never colour alone.
5. Lesson flow: finishing a lesson (the fade-away) marks it done, shows the "Next" slip from `nextLessonId` or "More lessons for this chapter are on the way" when there is none,
   and "Bring my code back" undoes the fade.
6. Only the Filter lesson has full content now. Chapters without lessons show "Lessons for this chapter are being written" in the detail slip, and still open from the map.
7. "Test out first" on the Map links to the placement quiz for now (single-chapter tests come later). Do not fake it.
8. Tests: placement recommendation (all correct, first wrong, middle wrong, skip), progress store (done, undo, persistence failure path).

## Finish
Stop. Report: how to run it, the routes, a manual checklist of at least 10 checks (include: type a typo and see the exact word circled and shaken;
fix it and get Approved; a different correct query also passes; `>=` fails with a hint about the boundary; fade away and bring back; placement all paths;
map status updates after finishing; reload keeps progress; 360px width; reduced motion), and anything you were unsure about.
Do not push. Do not start the sandbox, authentication or new lessons.
