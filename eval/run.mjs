// Planted-bug run: the ship gate on every sample in eval/samples (8 with one planted bug, 4 written clean), on testnet.
// Each sample buys SECURITY_REVIEW_GENERAL + CODE_REVIEW_GENERAL ($0.02). Writes to the ledger in GG_LEDGER (use a separate file).
//   GG_LEDGER=eval/ledger.eval.jsonl GG_REUSE=0 node eval/run.mjs        (then: node eval/score.mjs)
import fs from "node:fs";
import { shipCheck } from "../src/guards.mjs";
const dir = new URL("./samples/", import.meta.url);
const only = process.argv.slice(2);
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".sol")).sort()) {
  if (only.length && !only.includes(f)) continue;
  const t = Date.now();
  try {
    const d = await shipCheck(fs.readFileSync(new URL(f, dir), "utf8"), { name: f });
    console.log(new Date().toISOString(), f, d.verdict, `$${d.cost_usd}`, `${((Date.now() - t) / 1000).toFixed(1)} s`);
  } catch (e) { console.log(new Date().toISOString(), f, "ERROR", String(e.message || e).slice(0, 200)); }
}
