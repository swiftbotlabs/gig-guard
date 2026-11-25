import { test } from "node:test";
import assert from "node:assert/strict";
import { rewardFor } from "../src/reward.mjs";
const d = (verdict, local_findings = [], name = "A.sol") => ({ kind: "decision", gate: "ship", verdict, local_findings, input: { name }, receipts: ["0xabc"] });

test("simulated rewards: only FIX + a rule-confirmed finding pays; Miner-only, SHIP and HOLD pay nothing", () => {
  const s = { paid: new Set(), pool: 5000 };
  assert.deepEqual([rewardFor(d("SHIP"), s).usd, rewardFor(d("HOLD", ["selfdestruct (SWC-106)"]), s).usd, rewardFor(d("FIX"), s).usd], [0, 0, 0]);
  assert.match(rewardFor(d("FIX"), s).status, /Miner-only/);
  const r = rewardFor(d("FIX", ["selfdestruct (SWC-106)"]), s);
  assert.equal(r.usd, 500); assert.equal(r.severity, "high"); assert.deepEqual(r.receipts, ["0xabc"]);
  assert.equal(rewardFor(d("FIX", ["weak randomness (SWC-120)"], "B.sol"), s).usd, 200);
  assert.equal(s.pool, 4300);
});
test("simulated rewards: duplicates pay once, unknown SWC ids don't count, the pool caps the total", () => {
  const s = { paid: new Set(), pool: 700 };
  assert.equal(rewardFor(d("FIX", ["tx.origin used for auth (SWC-115)"]), s).usd, 500);
  assert.equal(rewardFor(d("FIX", ["tx.origin used for auth (SWC-115)"]), s).status, "duplicate");
  assert.match(rewardFor(d("FIX", ["something (SWC-999)"], "C.sol"), s).status, /Miner-only/);
  assert.match(rewardFor(d("FIX", ["delegatecall (SWC-112)"], "D.sol"), s).status, /pool exhausted/);
  assert.equal(rewardFor({ gate: "deliver", verdict: "SUBMIT" }, s).usd, 0);
});
