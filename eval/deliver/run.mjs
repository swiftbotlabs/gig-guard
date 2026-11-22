// Known-answer run of the deliver gate on Telegraph testnet (test USDC). One TASK_EXECUTION_QUALITY_GENERAL request per case
// (LLM_OUTPUT_EVALUATION_GENERAL as fallback), at most $0.01 each; 40 cases, run cap $0.60 (GG_DELIVER_MAX_USD).
// Resumable: a case already decided in the ledger is skipped.
//   GG_LEDGER=eval/deliver/ledger.deliver.jsonl GG_REUSE=0 node eval/deliver/run.mjs
import fs from "node:fs";
import { deliverCheck } from "../../src/guards.mjs";
import { readLedger } from "../../src/ledger.mjs";

const { cases } = JSON.parse(fs.readFileSync(new URL("./cases.json", import.meta.url), "utf8"));
const cap = Number(process.env.GG_DELIVER_MAX_USD || 0.6);
const spent = () => readLedger().filter((x) => x.kind === "purchase").reduce((s, x) => s + Number(x.cost_usd || 0), 0);
const done = new Set(readLedger().filter((x) => x.kind === "decision" && x.gate === "deliver").map((x) => x.input?.name));
for (const c of cases) {
  if (done.has(c.id)) continue;
  if (spent() + 0.01 > cap + 1e-9) { console.log(`stop: run cap $${cap} reached`); break; }
  try {
    const d = await deliverCheck({ task: c.task, result: c.result, mustInclude: c.mustInclude, name: c.id });
    console.log(new Date().toISOString(), c.id, d.verdict, `$${d.cost_usd}`);
  } catch (e) { console.log(c.id, "ERROR", String(e.message || e).slice(0, 200)); if (/daily cap|BudgetError/i.test(String(e))) break; }
}
console.log(JSON.stringify({ spent_usd: +spent().toFixed(4) }));
