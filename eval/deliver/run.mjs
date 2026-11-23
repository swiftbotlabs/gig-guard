// Known-answer run of the deliver gate on Telegraph testnet (test USDC). One TASK_EXECUTION_QUALITY_GENERAL request per case
// (LLM_OUTPUT_EVALUATION_GENERAL as fallback), at most $0.01 each; 40 cases, run cap $0.60 (GG_DELIVER_MAX_USD).
// Resumable: a case already decided in the ledger is skipped. If the prepaid escrow runs dry (HTTP 402 "insufficient escrow"),
// the run stops at once with exit code 3 and the deposit it needs; no HOLD is recorded for cases that were never judged.
//   GG_LEDGER=eval/deliver/ledger.deliver.jsonl GG_REUSE=0 node eval/deliver/run.mjs
import fs from "node:fs";
import { deliverCheck, JUDGE_BUDGET } from "../../src/guards.mjs";
import { readLedger } from "../../src/ledger.mjs";

const { cases } = JSON.parse(fs.readFileSync(new URL("./cases.json", import.meta.url), "utf8"));
const cap = Number(process.env.GG_DELIVER_MAX_USD || 0.6);
const spent = () => readLedger().filter((x) => x.kind === "purchase").reduce((s, x) => s + Number(x.cost_usd || 0), 0);
const left = (id) => cases.length - cases.findIndex((x) => x.id === id); // cases from this one to the end (worst case)
const done = new Set(readLedger().filter((x) => x.kind === "decision" && x.gate === "deliver").map((x) => x.input?.name));
for (const c of cases) {
  if (done.has(c.id)) continue;
  if (spent() + 0.01 > cap + 1e-9) { console.log(`stop: run cap $${cap} reached`); break; }
  try {
    const d = await deliverCheck({ task: c.task, result: c.result, mustInclude: c.mustInclude, name: c.id });
    console.log(new Date().toISOString(), c.id, d.verdict, `$${d.cost_usd}`);
  } catch (e) {
    if (e.name === "EscrowFundsError") { // nothing recorded for this case; it runs on the next pass
      const i = e.info || {};
      console.log(`stop: escrow balance exhausted at ${c.id} (balance ${i.balance} μUSDC, unbilled ${i.unbilled}, short ${i.shortfall}).`,
        `Deposit at least ${Math.max(i.shortfall || 0, left(c.id) * 2 * JUDGE_BUDGET)} μUSDC (LedgerFacet.depositUSDC), wait for the next ledger block, rerun; decided cases are skipped.`);
      process.exitCode = 3; break;
    }
    console.log(c.id, "ERROR", String(e.message || e).slice(0, 200)); if (/daily cap|BudgetError/i.test(String(e))) break;
  }
}
console.log(JSON.stringify({ spent_usd: +spent().toFixed(4) }));
