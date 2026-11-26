// Telegraph issue #228: a paid request that fails after it was signed can still be charged. The ledger must log the signed amount,
// the daily cap must count it, and the decision's cost must include it. An unsigned failure costs nothing. Fake node, no funds.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { challengeMessage } from "../src/escrowmsg.mjs";
process.env.GG_CONFIRM_SUBMIT = "0"; // these tests pin single-judge behaviour; confirm mode is the default since 26 Nov (tested in second-judge.test.mjs)

let failSigned = new Set(), failUnsigned = new Set();
const srv = http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
    const { intent, max_budget_usdc } = JSON.parse(b); const price = Number(max_budget_usdc);
    res.setHeader("content-type", "application/json");
    if (failUnsigned.has(intent)) { res.writeHead(503); return res.end('{"error":"no miner"}'); }
    if (!req.headers["x-payment"]) { res.writeHead(402); return res.end(JSON.stringify({ accepts: [{ scheme: "escrow", network: "eip155:11155111", payTo: "0x72a70e949362670bf8bcead24efc5b8f950aa08b", amount: String(price),
      extra: { message: challengeMessage(price) } }] })); }
    if (failSigned.has(intent)) { res.writeHead(504); return res.end('{"error":"miner timed out"}'); }   // signed, then failed: may be billed
    res.writeHead(200, { "X-TELEGRAPH-RECEIPT": Buffer.from(JSON.stringify({ receipt_hash: "0x" + "cd".repeat(32), amount_uusdc: 10000, intent, epoch_id: 8 })).toString("base64") });
    res.end(JSON.stringify({ miner_id: "7", cost_usd: 0.01, result: { verdict: "satisfies", score: 9, reason: "ok", rating: "Good" } }));
  });
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
Object.assign(process.env, { TELEGRAPH_NODE: `http://127.0.0.1:${srv.address().port}`, TELEGRAPH_PAYER_KEY: "0x" + "11".repeat(32),
  GG_LEDGER: path.join(os.tmpdir(), `gg-228-${process.pid}.jsonl`), GG_RAIL: "escrow", GG_REUSE: "0", GG_NO_RPC: "1", GG_MAX_PER_DAY: "40000" });
const g = await import("../src/guards.mjs");
const { spentToday, readLedger } = await import("../src/ledger.mjs");
test.after(() => srv.close());

test("#228: a signed request that fails is logged as possibly charged and counts toward the decision's cost and the daily cap", async () => {
  failSigned = new Set(["TASK_EXECUTION_QUALITY_GENERAL"]);
  const d = await g.deliverCheck({ task: "Add a totals row", result: "a,1\ntotal,1", name: "t228" });
  failSigned = new Set();
  const err = readLedger().find((e) => e.kind === "error" && e.intent === "TASK_EXECUTION_QUALITY_GENERAL");
  assert.equal(err.signed, true); assert.equal(err.charged_uusdc, 10000);
  assert.equal(d.verdict, "SUBMIT", "the fallback judge answered");
  assert.equal(+d.cost_usd.toFixed(4), 0.02, "failed-but-signed $0.01 + the fallback's $0.01");
  assert.equal(spentToday(), 20000);
});
test("#228: an unsigned failure (refused before payment) is not counted", async () => {
  const before = spentToday();
  failUnsigned = new Set(["TASK_EXECUTION_QUALITY_GENERAL"]);
  await g.deliverCheck({ task: "Add a totals row", result: "a,1\ntotal,1", name: "t228b" });
  failUnsigned = new Set();
  const err = readLedger().filter((e) => e.kind === "error").at(-1);
  assert.equal(err.signed, undefined);
  assert.equal(spentToday(), before + 10000, "only the fallback's paid answer");
});
test("#228: the cap stops new requests once failed-but-signed charges fill it", async () => {
  failSigned = new Set(["TASK_EXECUTION_QUALITY_GENERAL", "LLM_OUTPUT_EVALUATION_GENERAL"]);   // every request fails after signing
  let err = null;
  for (let i = 0; i < 6 && !err; i++) await g.deliverCheck({ task: "Add a totals row", result: "a,1\ntotal,1", name: `t228c${i}` }).catch((e) => { err = e; });
  failSigned = new Set();
  assert.equal(err?.name, "BudgetError", "nothing was ever paid, yet the failed signed requests must fill the $0.04 cap");
  assert.ok(spentToday() >= 40000 - 10000, String(spentToday()));
  fs.rmSync(process.env.GG_LEDGER, { force: true });
});
