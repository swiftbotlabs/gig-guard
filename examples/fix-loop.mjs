// The done-check closing the loop: a FIX verdict makes the agent redo the work, then the redone work is checked again.
//   planted wrong total -> paid judge -> FIX (reason) -> agent recomputes the total -> paid judge again -> SUBMIT
// Live (testnet, about $0.02 test USDC, escrow env as in docs/TUTORIAL.md):  GG_REUSE=0 node examples/fix-loop.mjs
// Offline (fake node, no funds):                                              node examples/fix-loop.mjs --offline
// No required-items list is passed, so the first FIX has to come from the paid judge, not from the free check.
// The redo here is a small deterministic repair (recompute the sum from the task); in a real agent it is the agent's own redo,
// guided by the judge's reason. Exit code 0 only if the loop ends in SUBMIT after a FIX.
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { challengeMessage } from "../src/escrowmsg.mjs";

const TASK = "Export these invoices to CSV with columns invoice,amount and a final row 'total' with the sum: INV-1 120.00, INV-2 80.50, INV-3 19.50.";
const FIRST = "invoice,amount\nINV-1,120.00\nINV-2,80.50\nINV-3,19.50\ntotal,210.00";   // planted defect: wrong total

let srv;
if (process.argv.includes("--offline")) {
  srv = http.createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
    const { intent, params, max_budget_usdc } = JSON.parse(b); const price = Number(max_budget_usdc || 10000);
    res.setHeader("content-type", "application/json");
    if (!req.headers["x-payment"]) { res.writeHead(402); return res.end(JSON.stringify({ accepts: [{ scheme: "escrow", network: "eip155:11155111", payTo: "0x72a70e949362670bf8bcead24efc5b8f950aa08b", amount: String(price),
      extra: { message: challengeMessage(price) } }] })); }
    const rows = (params.result.match(/^INV-\d+,([\d.]+)$/gm) || []).reduce((s, r) => s + Number(r.split(",")[1]), 0);
    const tot = Number((params.result.match(/^total,([\d.]+)$/m) || [])[1]);
    const ok = Math.abs(rows - tot) < 0.005;
    res.writeHead(200, { "X-TELEGRAPH-RECEIPT": Buffer.from(JSON.stringify({ receipt_hash: "0xoffline" + Math.random().toString(16).slice(2, 10), amount_uusdc: 10000, intent, epoch_id: 0 })).toString("base64") });
    res.end(JSON.stringify({ miner_id: "fake", cost_usd: 0.01, result: ok ? { verdict: "satisfies", score: 9, reason: "rows and total agree" }
      : { verdict: "fails", score: 2, reason: `the total row says ${tot.toFixed(2)} but the amounts sum to ${rows.toFixed(2)}` } }));
  }); });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  Object.assign(process.env, { TELEGRAPH_NODE: `http://127.0.0.1:${srv.address().port}`, TELEGRAPH_PAYER_KEY: "0x" + "11".repeat(32),
    GG_LEDGER: path.join(os.tmpdir(), `gg-fixloop-${process.pid}.jsonl`), GG_RAIL: "escrow", GG_REUSE: "0" });
}
const { deliverCheck } = await import("../src/guards.mjs");

// The agent's redo: recompute the total row from the task's own amounts.
function redo(task, result) {
  const sum = [...task.matchAll(/INV-\d+ (\d+(?:\.\d+)?)/g)].reduce((s, m) => s + Number(m[1]), 0);
  return result.replace(/^total,[\d.]+$/m, `total,${sum.toFixed(2)}`);
}
const line = (d) => `${d.verdict}  $${Number(d.cost_usd).toFixed(2)}  receipt ${d.receipts?.[0] || "none"}  | ${d.reasons.join(" | ")}`;

console.log(`task: ${TASK}\n\nattempt 1 (as delivered):\n${FIRST}`);
const d1 = await deliverCheck({ task: TASK, result: FIRST, name: "fix-loop/attempt-1" });
console.log(`check 1: ${line(d1)}`);
let code = 1;
if (d1.verdict !== "FIX") console.log(`\nno FIX on the planted defect (${d1.verdict}): the loop has nothing to fix; reported as found.`);
else {
  const second = redo(TASK, FIRST);
  console.log(`\nattempt 2 (redone after FIX):\n${second}`);
  const d2 = await deliverCheck({ task: TASK, result: second, name: "fix-loop/attempt-2" });
  console.log(`check 2: ${line(d2)}`);
  console.log(`\n${d2.verdict === "SUBMIT" ? "SUBMIT after one redo" : `still ${d2.verdict} after the redo: a human looks`}; total $${(Number(d1.cost_usd) + Number(d2.cost_usd)).toFixed(2)}`);
  if (d2.verdict === "SUBMIT") code = 0;
}
srv?.close(); process.exitCode = code;
