// Copies the DuckDB WASM engine (from node_modules) and the vendored json
// extension into public/duckdb, so the app serves them from its own origin.
// Fails loudly if the installed package or a vendored file does not match
// the pins in lib/engine/duckdb-assets.json. Runs before dev and build.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pins = JSON.parse(readFileSync(join(root, "lib/engine/duckdb-assets.json"), "utf8"));
const pkgDir = join(root, "node_modules/@duckdb/duckdb-wasm");
const installed = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")).version;

if (installed !== pins.duckdbWasm) {
  console.error(
    `@duckdb/duckdb-wasm ${installed} is installed but ${pins.duckdbWasm} is pinned.\n` +
      `Update lib/engine/duckdb-assets.json (duckdbWasm, duckdbCore) and the vendored json extension in vendor/duckdb-extensions for the new DuckDB core version.`,
  );
  process.exit(1);
}

const out = join(root, "public/duckdb");
rmSync(out, { recursive: true, force: true });

const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const copy = (from, to) => {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  return statSync(to).size;
};

let total = 0;
for (const { module, worker } of Object.values(pins.bundles)) {
  for (const name of [module, worker]) total += copy(join(pkgDir, "dist", name), join(out, pins.duckdbWasm, name));
}
for (const [rel, expected] of Object.entries(pins.extensions)) {
  const from = join(root, "vendor/duckdb-extensions", pins.duckdbCore, rel);
  if (!existsSync(from)) {
    console.error(`Missing vendored extension ${from}`);
    process.exit(1);
  }
  const actual = sha256(from);
  if (actual !== expected) {
    console.error(`Checksum mismatch for ${rel}: expected ${expected}, got ${actual}`);
    process.exit(1);
  }
  total += copy(from, join(out, "extensions", pins.duckdbCore, rel));
}
console.log(`DuckDB assets ${pins.duckdbWasm} (core ${pins.duckdbCore}) copied to public/duckdb (${(total / 1e6).toFixed(1)} MB in total, one bundle is used per visit).`);
