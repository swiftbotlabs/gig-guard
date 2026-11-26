// Second opinion for the done-check: other Miners by id, majority vote, HOLD on no majority. Fake node; answers depend on the Miner id.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { challengeMessage } from "../src/escrowmsg.mjs";
process.env.GG_CONFIRM_SUBMIT = "0"; // these tests pin single-judge behaviour; confirm mode is the default since 26 Nov (tested in second-judge.test.mjs)

let plan = {}; const asked = [];
const srv = http.createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
  const { intent, max_budget_usdc } = JSON.parse(b); const price = Number(max_budget_usdc);
  res.setHeader("content-type", "application/json");
  const routed = (req.url.match(/\/ask\/(\d+)$/) || [])[1];   // like the live node: the per-Miner route says "Resource: /v1/ask/{id}"
  if (!req.headers["x-payment"]) { res.writeHead(402); return res.end(JSON.stringify({ accepts: [{ scheme: "escrow", network: "eip155:11155111", payTo: "0x72a70e949362670bf8bcead24efc5b8f950aa08b", amount: String(price), extra: { message: challengeMessage(price, undefined, undefined, routed) } }] })); }
  const miner = (req.url.match(/\/ask\/(\d+)$/) || [])[1] || "302";   // the routed (generic) ask is answered by miner 302
  asked.push(miner);
  const v = plan[miner];
  if (v === "down") { res.writeHead(504); return res.end('{"error":"timeout"}'); }
  res.writeHead(200, { "X-TELEGRAPH-RECEIPT": Buffer.from(JSON.stringify({ receipt_hash: "0x" + miner.padStart(64, "0"), amount_uusdc: 10000, intent, epoch_id: 9 })).toString("base64") });
  res.end(JSON.stringify({ miner_id: miner, cost_usd: 0.01, result: { verdict: v === "unclear" ? null : v, reason: `miner ${miner} says ${v}` } }));
}); });
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
Object.assign(process.env, { TELEGRAPH_NODE: `http://127.0.0.1:${srv.address().port}`, TELEGRAPH_PAYER_KEY: "0x" + "11".repeat(32),
  GG_LEDGER: path.join(os.tmpdir(), `gg-2nd-${process.pid}.jsonl`), GG_RAIL: "escrow", GG_REUSE: "0", GG_SECOND_JUDGES: "302,20260828,7442,76441" });
const g = await import("../src/guards.mjs");
test.after(() => srv.close());
const run = async (p, o = {}) => { plan = p; asked.length = 0; return g.deliverCheck({ task: "Dedupe this CSV", result: "id,name\n1,Ann\n2,Bo", secondJudge: true, ...o }); };

test("a false 'fails' is overturned only by a majority: 302 fails, 20260828 and 7442 pass -> SUBMIT, with the split shown", async () => {
  const d = await run({ 302: "fails", 20260828: "satisfies", 7442: "satisfies" });
  assert.equal(d.verdict, "SUBMIT"); assert.deepEqual(asked, ["302", "20260828", "7442"]);
  assert.match(d.reasons.join(" "), /judge panel \(3 Miners\): fail, pass, pass: majority pass/); assert.ok(d.uncertainty.includes("judges disagreed; decided by majority"));
  assert.equal(+d.cost_usd.toFixed(2), 0.03);
});
test("two judges agree on fails -> FIX, no third purchase", async () => {
  const d = await run({ 302: "fails", 20260828: "fails" });
  assert.equal(d.verdict, "FIX"); assert.deepEqual(asked, ["302", "20260828"]);
});
test("no majority (fails / satisfies / unclear) -> HOLD; no second Miner answering -> HOLD", async () => {
  assert.equal((await run({ 302: "fails", 20260828: "satisfies", 7442: "unclear" })).verdict, "HOLD");
  const d = await run({ 302: "unclear", 20260828: "down", 7442: "down", 76441: "down" });
  assert.equal(d.verdict, "HOLD"); assert.match(d.reasons.join(" "), /no second Miner answered/);
});
test("not used when the first judge passes, when a required item is missing, or when the option is off", async () => {
  assert.equal((await run({ 302: "satisfies" })).verdict, "SUBMIT"); assert.deepEqual(asked, ["302"]);
  assert.equal((await run({ 302: "fails", 20260828: "satisfies", 7442: "satisfies" }, { mustInclude: ["3,Cy"] })).verdict, "FIX"); assert.deepEqual(asked, ["302"]);
  assert.equal((await run({ 302: "fails", 20260828: "satisfies" }, { secondJudge: false })).verdict, "FIX"); assert.deepEqual(asked, ["302"]);
});

test("confirm mode: a single 'satisfies' is not enough; 2 passes SUBMIT, pass/fail/fail FIX, no second answer HOLD; ON by default (GG_CONFIRM_SUBMIT=0 turns it off)", async () => {
  let d = await run({ 302: "satisfies", 20260828: "satisfies" }, { secondJudge: false, confirmSubmit: true });
  assert.equal(d.verdict, "SUBMIT"); assert.deepEqual(asked, ["302", "20260828"]);
  d = await run({ 302: "satisfies", 20260828: "fails", 7442: "fails" }, { secondJudge: false, confirmSubmit: true });
  assert.equal(d.verdict, "FIX"); assert.deepEqual(asked, ["302", "20260828", "7442"]);
  d = await run({ 302: "satisfies", 20260828: "down", 7442: "down", 76441: "down" }, { secondJudge: false, confirmSubmit: true });
  assert.equal(d.verdict, "HOLD"); assert.match(d.reasons.join(" "), /no second Miner answered/);
  d = await run({ 302: "satisfies" }, { secondJudge: false });                 // GG_CONFIRM_SUBMIT=0: single judge
  assert.equal(d.verdict, "SUBMIT"); assert.deepEqual(asked, ["302"]);
  delete process.env.GG_CONFIRM_SUBMIT;                                           // unset = the default: confirm ON
  try {
    d = await run({ 302: "satisfies" }, { secondJudge: false });
    assert.equal(d.verdict, "HOLD"); assert.ok(asked.length > 1, "a lone pass asks other Miners by default");
    d = await run({ 302: "satisfies", 20260828: "satisfies" }, { secondJudge: false });
    assert.equal(d.verdict, "SUBMIT"); assert.deepEqual(asked, ["302", "20260828"]);
  } finally { process.env.GG_CONFIRM_SUBMIT = "0"; }
});
