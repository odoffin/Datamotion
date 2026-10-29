# Datamotion

A web app that teaches SQL by animating real code execution. Each lesson runs
the learner's own query on a real database in the browser
([DuckDB WASM](https://duckdb.org/docs/api/wasm/overview)), circles mistakes
in red pen, and animates the result row by row from the actual execution.

The name is a working title; it lives in `lib/brand.ts`.

## What is in it

- **Lessons** (`/lesson/[id]`): type SQL, run it, see the exact word that is
  wrong, and watch every row get its verdict. Only the Filtering lesson is
  written so far.
- **Chapter map** (`/chapters`) and an optional **placement quiz**
  (`/placement`). Nothing is locked.
- **Progress** is stored in the browser's localStorage (`dm.progress.v1`).
  There are no accounts yet.
- Design system: `DESIGN.md` (the Ledger). Build plan: `BUILD-PHASE-2.md`.

## Run it locally

Developed and tested with Node 26.

```sh
npm install
cp .env.example .env.local   # optional; the app runs with the values empty
npm run dev                  # http://localhost:3000
```

`npm run dev` and `npm run build` first run `npm run assets`, which copies the
DuckDB engine from `node_modules` and the vendored json extension
(`vendor/duckdb-extensions`) into `public/duckdb`. The app serves them from its
own origin; nothing is loaded from a CDN.

## Test

```sh
npm run lint
npm run typecheck   # regenerates Next route types, then tsc
npm test            # Vitest; runs the engine against native DuckDB (@duckdb/node-api)
npm run build && npm start   # production build on http://localhost:3000
```

The tests cover the SQL checker and error pointing, the animation invariant
(the animated surviving rows always equal the real query's rows), placement
scoring, and saved progress, including blocked storage.

## Deploy to Vercel

1. Import the repository in Vercel. The framework preset (Next.js) and the
   default build command (`npm run build`) are correct; the `prebuild` step
   copies the DuckDB files.
2. Optionally add `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` under Project Settings >
   Environment Variables.
3. Deploy. Security headers (including a Content-Security-Policy) are set in
   `next.config.ts`; the DuckDB files under `/duckdb` are served with a
   one-year immutable cache because their path includes the version.

### Upgrading DuckDB

`@duckdb/duckdb-wasm` is pinned in `lib/engine/duckdb-assets.json`. After
upgrading the package, update `duckdbWasm` and `duckdbCore` there, put the
matching `json.duckdb_extension.wasm` files for `wasm_eh` and `wasm_mvp` into
`vendor/duckdb-extensions/<core version>/`, and update their SHA-256 pins.
The build fails with a clear message until these match.
