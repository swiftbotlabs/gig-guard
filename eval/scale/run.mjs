// Scale run: the ship gate on every contract in eval/scale/manifest.json, on Telegraph testnet (test USDC).
// Each contract buys SECURITY_REVIEW_GENERAL + CODE_REVIEW_GENERAL (at most $0.02); failed requests are not charged.
// Resumable: a contract already decided in the ledger is skipped. Stops before the run's own cap (GG_SCALE_MAX_USD, default $2.60).
//   GG_LEDGER=eval/scale/ledger.scale.jsonl GG_REUSE=0 GG_MAX_PER_DAY=3000000 node eval/scale/run.mjs
import fs from "node:fs";
import crypto from "node:crypto";
import { shipCheck } from "../../src/guards.mjs";
import { readLedger } from "../../src/ledger.mjs";

const man = JSON.parse(fs.readFileSync(new URL("./manifest.json", import.meta.url), "utf8"));
const cap = Number(process.env.GG_SCALE_MAX_USD || 2.6);
const decided = () => new Set(readLedger().filter((x) => x.kind === "decision" && x.gate === "ship").map((x) => x.input?.name));
const spent = () => readLedger().filter((x) => x.kind === "purchase").reduce((s, x) => s + Number(x.cost_usd || 0), 0);
const done = decided();
let n = 0;
for (const it of man.items) {
  if (done.has(it.name)) continue;
  if (spent() + 0.02 > cap + 1e-9) { console.log(`stop: run cap $${cap} reached ($${spent().toFixed(2)} spent)`); break; }
  const src = fs.readFileSync(new URL(`./samples/${it.name}`, import.meta.url), "utf8");
  if (crypto.createHash("sha256").update(src).digest("hex") !== it.sha256) { console.log(it.name, "SKIP: file differs from manifest"); continue; }
  const t = Date.now();
  try {
    const d = await shipCheck(src, { name: it.name });
    console.log(new Date().toISOString(), ++n, it.name, d.verdict, `$${d.cost_usd}`, `${((Date.now() - t) / 1000).toFixed(1)} s`);
  } catch (e) { console.log(new Date().toISOString(), it.name, "ERROR", String(e.message || e).slice(0, 200)); if (/daily cap|BudgetError/i.test(String(e))) break; }
}
console.log(JSON.stringify({ decided: decided().size, of: man.items.length, spent_usd: +spent().toFixed(4) }));
