# DESIGN.md: the Ledger (locked design system)

This file is the source of truth for how the app looks. Do not invent a new look.
The approved screens live in `design/reference/` (Lesson, Map, Placement as `.dc.html`).
Open them to see exact spacing, copy tone and behaviour. Port them to React/Tailwind;
do not copy the Design Component markup literally.

## Idea
The app is a notebook. The learner writes on a request slip, and the database answers in a
ledger: ruled lines, a red margin line, ink and red pen. Wrong syntax is circled in red pen.
Once the learner is comfortable, the code fades like dried ink and the next lesson appears.

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
Radius: 2px on buttons, 0 on slips and sheets. Slips carry one hard shadow: 6px 6px 0 var(--ink).
No gradients, no glow, no blur on surfaces, no dot grid, no glassmorphism.

## Type (isolate in lib/fonts.ts so it can be swapped in one place)
Display and headings: Fraunces (600). Code and numbers: IBM Plex Mono. Margin notes: Caveat (red pen, short, max 6 words).
UI text: Inter for now. TODO: replace with a more distinctive face after the owner chooses from Free Faces.
Labels are sentence case, untracked, never capitals with letter spacing. No eyebrows.

## Components
- Ledger sheet: bordered sheet, header row with serif title and a count, ruled rows, red margin line at 72px.
- Request slip: bordered sheet with hard shadow, one-line-to-few-lines SQL editor, Run and Start over.
- Diagnostic strip: tokens of the learner's query in mono. The wrong token is circled in red pen (outline, 50% radius), shakes once, and a Caveat note under it says what was expected.
- Row states are never colour alone: kept = check icon + the word kept (green); dropped = x icon + the word dropped, struck-through amount, row nudged right and dimmed.
- Buttons: solid (ink on sheet) and line (outlined). Min height 44px. Visible focus ring: 2px ink, 3px offset.
- Long explanations are hidden behind "Read the long version", never a wall of text on first view.

## Motion
Shake: 0.45s, translateX +-6px, alternating two keyframe names so it replays each failed run.
Fade away: opacity, blur 8px, translateY -10px and max-height to 0 over 0.9s, then visibility hidden.
Rows: opacity and transform only (never animate width, height, top or left). No `transition: all`.
Every animation has a prefers-reduced-motion fallback (no motion, state changes instantly).

## Layout
Desktop max width 1440 with 56px gutters. Two columns (explanation | workspace) wrapping to one column
below about 900px. No horizontal page scroll at 360px. Touch targets at least 44px.

## Accessibility
WCAG AA contrast. aria-live="polite" on narration, role="alert" on diagnostics, role="status" on success.
Full keyboard use. Space/arrow shortcuts only on the playback bar, never global.

## Never
Invented stats, fake testimonials, emoji as icons, purple-blue gradients, cards inside cards,
tracked-capital labels, middle-dot-joined meta strings, decorative status dots.
