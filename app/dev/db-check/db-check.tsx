"use client";

import { useEffect, useState } from "react";
import { shop } from "@/content/datasets/shop";
import { loadDataset, runQuery } from "@/lib/engine/db";

const SQL = "SELECT * FROM orders WHERE amount > 50";

type Check = { status: "running" } | { status: "done"; pass: boolean; detail: string };

/** Dev-only smoke test: the browser database agrees with a plain JS filter. */
export function DbCheck() {
  const [check, setCheck] = useState<Check>({ status: "running" });

  useEffect(() => {
    void (async () => {
      const loadError = await loadDataset(shop);
      if (loadError) {
        setCheck({ status: "done", pass: false, detail: loadError });
        return;
      }
      const res = await runQuery(SQL);
      if (res.error) {
        setCheck({ status: "done", pass: false, detail: res.error });
        return;
      }
      const orders = shop.tables.find((t) => t.name === "orders");
      const expected = (orders?.rows ?? []).filter((r) => (r[3] as number) > 50).map((r) => r[0]);
      const actual = res.rows.map((r) => r[0]);
      const pass = JSON.stringify(expected) === JSON.stringify(actual);
      setCheck({
        status: "done",
        pass,
        detail: `expected ids ${expected.join(", ")}\nactual ids   ${actual.join(", ")}\n${res.rows.length} rows in ${res.ms.toFixed(1)} ms`,
      });
    })();
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 font-mono text-sm">
      <h1 className="mb-4 font-sans text-lg font-semibold">DuckDB-WASM check</h1>
      <p className="mb-4 text-text-secondary">{SQL}</p>
      {check.status === "running" ? (
        <p>Running…</p>
      ) : (
        <>
          <p data-testid="db-check-status" className="mb-2 font-semibold">
            {check.pass ? "PASS ✓" : "FAIL ✗"}
          </p>
          <pre className="whitespace-pre-wrap text-text-secondary">{check.detail}</pre>
        </>
      )}
    </div>
  );
}
