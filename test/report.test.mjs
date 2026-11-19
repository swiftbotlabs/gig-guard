// Mission 10 report: grades and cost per verified correct answer, from a hand-made ledger (no network, no funds).
import { test } from "node:test";
import assert from "node:assert/strict";
import { costReport, grade, reportMarkdown } from "../src/report.mjs";

const bal = (b, miner = "A") => ({ intent: "WALLET_BALANCE_CHECK_GENERAL", ok: true, result: { balance: b }, miner_id: miner, cost_usd: 0.01, tried: [] });
const chainRead = (b) => ({ intent: "CHAIN_READ (free)", ok: true, result: { balance: b }, cost_usd: 0 });
const sol = (local) => ({ kind: "decision", gate: "ship", input: { solidity: true }, local_findings: local });
const sec = (r) => ({ intent: "SECURITY_REVIEW_GENERAL", ok: true, result: r, miner_id: "S", cost_usd: 0.01, tried: [] });
const code = (r) => ({ intent: "CODE_REVIEW_GENERAL", ok: true, result: r, miner_id: "C", cost_usd: 0.01, tried: [] });
const ledger = [
  { kind: "decision", gate: "claim", evidence: [bal(0), chainRead(0)] },                         // correct
  { kind: "decision", gate: "claim", evidence: [bal(500, "B"), chainRead(0)] },                  // incorrect: chain says 0
  { kind: "decision", gate: "claim", evidence: [{ ok: false, intent: "WALLET_BALANCE_CHECK_GENERAL",
      tried: [{ intent: "WALLET_BALANCE_CHECK_GENERAL", error: "empty answer", receipt: "0x1", cost_usd: 0.01 },
              { intent: "WALLET_BALANCE_CHECK_GENERAL", error: "HTTP 503" }] }] },                // one paid empty, one unpaid failure
  { kind: "decision", gate: "claim", evidence: [{ ...bal(0), reused: "0xold", cost_usd: 0 }, chainRead(0)] }, // reuse: not graded
  { ...sol(["tx.origin used for auth (SWC-115)"]), evidence: [sec({ verdict: "Insecure", vulnerability_count: 1 }), code({ verdict: "Comment", findings: ["use === in JavaScript"] })] },
  { ...sol([]), evidence: [sec({ verdict: "Secure" }), code({ verdict: "Request changes", findings: ["style"] })] },
  { kind: "decision", gate: "scout", input: {}, evidence: [{ intent: "URL_SCAN_VERDICT", ok: true, result: { safe: true }, miner_id: "U", cost_usd: 0.01, tried: [] }] },
];

test("report: each paid answer gets one grade from a check that does not trust the miner", () => {
  assert.equal(grade(ledger[0], ledger[0].evidence[0]).grade, "correct");
  assert.equal(grade(ledger[1], ledger[1].evidence[0]).grade, "incorrect");
  assert.equal(grade(ledger[4], ledger[4].evidence[0]).grade, "correct");    // flagged + rule agrees
  assert.equal(grade(ledger[4], ledger[4].evidence[1]).grade, "incorrect");  // missed tx.origin
  assert.equal(grade(ledger[5], ledger[5].evidence[0]).grade, "correct");    // clean + no rule
  assert.equal(grade(ledger[5], ledger[5].evidence[1]).grade, "unconfirmed");// flag no rule backs
  assert.equal(grade(ledger[6], ledger[6].evidence[0]).grade, "unknown");    // no check exists: never "correct"
  assert.equal(grade({ evidence: [] }, bal(0)).grade, "unknown");            // balance with no chain read
  assert.equal(grade({ evidence: [chainRead(0)] }, bal(null)).grade, "empty");
});

test("report: cost per verified correct answer counts wasted and wrong answers, skips reuse and free reads", () => {
  const r = costReport(ledger);
  assert.equal(r.totals.paid, 8);            // 2 balances + 1 paid empty + 4 reviews + 1 scan
  assert.equal(r.totals.correct, 3);
  assert.equal(r.totals.incorrect, 2);
  assert.equal(r.totals.empty, 1);
  assert.equal(r.totals.unconfirmed, 1);
  assert.equal(r.totals.unknown, 1);
  assert.equal(r.totals.cost_per_verified_correct_usd, +(0.08 / 3).toFixed(4));
  assert.equal(r.totals.checkable_spend_usd, 0.06); // excludes the scan and the unconfirmed-only row
  const a = r.by_intent_miner.find((x) => x.intent === "WALLET_BALANCE_CHECK_GENERAL" && x.miner === "A");
  assert.deepEqual([a.paid, a.correct, a.cost_per_verified_correct_usd], [1, 1, 0.01]);
  const b = r.by_intent_miner.find((x) => x.miner === "B");
  assert.equal(b.cost_per_verified_correct_usd, null); // never right: no price per correct answer
  const md = reportMarkdown(r);
  assert.match(md, /said 500, chain says 0/);
  assert.match(md, /passed code where a local rule fires: tx.origin/);
  assert.doesNotMatch(md, /0x[0-9a-f]{40}/i); // no wallets in the public report
});

test("report: an empty ledger gives zeros, not a crash", () => {
  const r = costReport([]);
  assert.equal(r.totals.paid, 0);
  assert.equal(r.totals.cost_per_verified_correct_usd, null);
  assert.match(reportMarkdown(r), /n\/a/);
});
