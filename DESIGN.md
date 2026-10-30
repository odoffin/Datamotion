# DESIGN.md: the Ledger (locked design system)

This file is the source of truth for how the app looks. Do not invent a new look.
The approved screens live in `design/reference/` (Landing, Loader, Lesson, Map, Placement as `.dc.html`).
Open them to see exact spacing, copy tone and behaviour. Port them to React/Tailwind;
do not copy the Design Component markup literally.

## Idea
The app is a notebook. The learner writes on a request slip, and the database answers in a
ledger: ruled lines, a red margin line, ink and red pen. Wrong syntax is circled in red pen.
Once the query is approved, the learner explains it back in one sentence, then moves on or does it again.

## Tokens (declare once in globals.css; no literal colours elsewhere)
--paper #F3EDE0   page ground
--sheet #FBF8F1   slips and ledger sheets
--ink #1D1B16     text, borders, solid buttons
--muted #625D50   secondary text (4.5:1 on paper and sheet)
--rule #D9D1BC    ruled lines
--margin #D98B83  the ledger margin line
--pen #C2362B     errors, dropped rows (tweakable accent)
--good #2B6648    kept rows, success
--key #1F4E79     SQL keywords
--num #8A5A00     SQL numbers
--marker #F4E19A  highlighter: what a step reads or keeps (Watch it run)
--marker-soft #FAF0C8  the rows a step keeps
Radius: 2px on buttons, 0 on slips and sheets. Slips carry one hard shadow: 6px 6px 0 var(--ink).
No gradients, no glow, no blur on surfaces, no dot grid, no glassmorphism. The one exception is
notebook ruling: .ruled draws a rule line every 32px under text set at line-height 32px.

## Type (isolate in lib/fonts.ts so it can be swapped in one place)
Display and headings: Fraunces (600). Code and numbers: IBM Plex Mono. Margin notes: Caveat (red pen, short, max 6 words).
UI text: Inter for now. TODO: replace with a more distinctive face after the owner chooses from Free Faces.
Labels are sentence case, untracked, never capitals with letter spacing. No eyebrows.

## Components
- Notebook page (NotebookPage): a slip with three punched holes and the red margin line down the left, and an optional handwritten note in the margin (the lesson number, "3.1"). The lesson page and the request slip are notebook pages.
- Lesson page (textbook): "Chapter 3, lesson 1 of 5", the headline, "Words to know" (the concept tags) and a "Key idea" box whose text sits on ruled lines.
- Divider tabs (TabList variant "index"): the workbench tabs stand up from the page like notebook dividers; the chosen tab is the page's paper and covers its top rule. Short names on phones (Watch, Read, Result, Columns).
- Check yourself: the end-of-lesson question (explain it back), titled like a textbook's end-of-section check.
- Piece by piece (Read it): every word and mark of the query with its meaning in very plain words, line by line, after "In plain words" (the whole query as one sentence). It says what the ; and the quote marks around text mean, and that spacing is only for people.
- Ledger sheet: bordered sheet, header row with serif title and a count, ruled rows, red margin line at 72px.
- Request slip: bordered sheet with hard shadow, one-line-to-few-lines SQL editor, Run and Start over.
- Diagnostic strip: tokens of the learner's query in mono. The wrong token is circled in red pen (outline, 50% radius), shakes once, and a Caveat note under it says what was expected.
- Row states are never colour alone: kept = check icon + the word kept (green); dropped = x icon + the word dropped, struck-through amount, row nudged right and dimmed.
- Buttons: solid (ink on sheet) and line (outlined). Min height 44px. Visible focus ring: 2px ink, 3px offset.
- Long explanations are hidden behind "Read the long version", never a wall of text on first view.
- Watch it run (workbench tab, query lessons): the learner's last query beside the real table. A strip of steps in run order (label and rows left), the query one clause per block with its run-order number, and the table that step leaves: WHERE, HAVING and LIMIT mark every row kept or dropped, the columns a step reads are washed, ORDER BY slides rows to their new place. Play walks the steps (pausable); Previous and Next, the strip and the clause blocks all jump. Lessons that change data keep the before-and-after ledger. Spotlight: the columns a step reads (or SELECT keeps) carry the highlighter (--marker) in the table and in the query; the rows it keeps a soft wash (--marker-soft); dropped rows are crossed out and faded. A plain sentence above the table says what is highlighted. A SELECT that only picks columns shows the table before it with the kept columns highlighted.
- Query layout (house style): a ; at the end of every statement, keywords in capitals, one clause per line, four-space indents, one column per line from three columns, extra AND / OR on their own lines, ON under its JOIN, AS for aliases. Starter slips, answers and puzzles use it; Tidy up applies it; tidying is never counted as an edit.
- Read it (workbench tab): the learner's last query in the order the database runs it. One ruled line per step, a red-pen margin word (first, then, last), the clause in mono, one plain sentence, rows in and out, and a figure where it helps: real rows with their verdicts under WHERE, row matches under JOIN (never Venn circles). Opens by itself after a run the animation can only simplify.
- Step through (inside Read it): Previous and Next open one step at a time, marked like the ledger's checking row. The open step shows its figure, a number to drag and the real table after it (first 10 rows).
- Drag the number: a WHERE, HAVING or LIMIT number becomes a slider over the data's own range. One mark per row (tall ink = kept, short = dropped) and the count in words; "Back to 50" returns to the learner's value.
- Explain it back: after approval, finish one sentence about the query by choosing among three endings built from the learner's own query (near misses such as >= for >). A wrong ending is crossed out; the right one comes with the reason.
- Parsons puzzle: one answer's lines, shuffled, tapped back into written order with buttons (no dragging). Offered once a hint is out.
- After approval: explain it back, then "Next lesson" or "Do it again" (the starter slip, verdicts cleared; the lesson stays done).
- Ledger rows: column names once in a header, values only in the rows (screen readers hear each value with its column name).

## Motion
Shake: 0.45s, translateX +-6px, alternating two keyframe names so it replays each failed run.
Scroll: Lenis smooth scrolling (off with reduced motion; inner scroll boxes opt out with data-lenis-prevent).
Rows: opacity and transform only (never animate width, height, top or left). No `transition: all`.
Watch it run: rows new to a step fade in (0.35s); rows that stay slide to their new place (FLIP, 0.45s, Web Animations). Reduced motion: no fade, no slide, and Play does not start by itself.
Every animation has a prefers-reduced-motion fallback (no motion, state changes instantly).

## Layout
Desktop max width 1440 with 56px gutters. Two columns (explanation | workspace) wrapping to one column
below about 900px. No horizontal page scroll at 360px. Touch targets at least 44px.

## Accessibility
WCAG AA contrast. aria-live="polite" on narration, role="alert" on diagnostics, role="status" on success.
Full keyboard use. Space/arrow shortcuts only on the playback bar, never global.

## Usability heuristics
Based on the NN/g ten usability heuristics (nngroup.com/articles/ten-usability-heuristics).
One line each on how the app meets it. These are rules: a screen that breaks one is a bug.

1. Visibility of system status: every loading or failure state is visible and in plain words (starting the database, preparing the checker, running), and the narration says what the database is doing to each row.
2. Match between the system and the real world: the notebook speaks the learner's language (request slip, ledger, red pen, kept and dropped), never engine terms like "predicate" or "binder".
3. User control and freedom: every animation can be paused, stepped and restarted, and Start over and Do it again reset without penalty.
4. Consistency and standards: one Ledger system everywhere (same tokens, two button styles, row states always as icon plus word) and standard SQL with the same colours in every editor and diagnostic.
5. Error prevention: a lesson is finished only by a correct attempt, and Do it again is always available; the read-only sandbox means no query can damage the data.
6. Recognition rather than recall: the schema and column names stay visible next to the editor, so nobody has to remember what a table holds.
7. Flexibility and efficiency of use: chapters are never locked, the placement quiz is optional, and keyboard users get Enter to run and playback keys.
8. Aesthetic and minimalist design: one idea per screen, long explanations behind "Read the long version", and no decoration that does not carry meaning.
9. Help users recognise, diagnose and recover from errors: every error names the problem and a fix, with the red pen circling the exact word.
10. Help and documentation: hints nudge without giving the answer away, and the long explanation is one click away inside the lesson.

## Never
Invented stats, fake testimonials, emoji as icons, purple-blue gradients, cards inside cards,
tracked-capital labels, middle-dot-joined meta strings, decorative status dots.
