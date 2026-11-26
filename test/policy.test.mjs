// Policy tests against a fake Telegraph node that speaks real x402 headers (no network, no funds).
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import path from "node:path";
process.env.GG_CONFIRM_SUBMIT = "0"; // these tests pin single-judge behaviour; confirm mode is the default since 26 Nov (tested in second-judge.test.mjs)

const WALLET = "0x3333333333333333333333333333333333333333";
const answers = {
  URL_SCAN_VERDICT: (p) => ({ verdict: p.url.includes("evil") ? "Malicious" : "Safe" }),
  WEB_SEARCH_GENERAL: (p) => ({ brief: /shadyco/i.test(p.query) ? "Several winners report ShadyCo never paid prizes." : `${p.query.split(" ")[0]} winners report prizes paid within two weeks.`, sources: [`https://news.example/${p.query.split(" ")[0].toLowerCase()}-winners-paid`] }),
  NEWS_SEARCH_GENERAL: () => ({ brief: "fallback answer", sources: ["n"] }),
  // live shape: on bsc a token SYMBOL gets an all-null answer, a token CONTRACT gets the balance
  WALLET_BALANCE_CHECK_GENERAL: (p) => p.chain === "bsc" && !p.token.startsWith("0x") ? { address: null, chain: null, balance: null, token_symbol: p.token, as_of: null }
    : p.chain === "tron" ? { address: null, chain: null, balance: null, token_symbol: p.token, as_of: null }
    : ({ address: p.address, balance: /USDT|0xdAC17/i.test(p.token) ? 0 : 500, token_symbol: p.token || "ETH", as_of: new Date().toISOString() }),
  ONCHAIN_TX_LOOKUP_GENERAL: (p) => ({ status: p.tx_hash.endsWith("00") ? "reverted" : "confirmed", to: WALLET.toLowerCase() }),
  CONTRACT_OBLIGATION_AUDIT_GENERAL: () => ({ verdict: "Non-compliant", summary: "Organizer must pay winners within 30 days.", obligations: ["pay within 30 days"] }),
  SECURITY_REVIEW_GENERAL: (p) => p.target.includes("nullverdict") ? { verdict: null, vulnerability_count: 1, issues: ["CWE-863"], summary: null } : ({ verdict: p.target.includes("tx.origin") ? "Insecure" : "Secure", vulnerability_count: p.target.includes("tx.origin") ? 1 : 0, issues: ["SWC-115"] }),
  SMART_CONTRACT_AUDIT_GENERAL: (p) => ({ verdict: p.code.includes("tx.origin") ? "High" : "Low" }),
  CODE_REVIEW_GENERAL: () => ({ verdict: "Approve", summary: "ok" }),
  // deliver gate: the fake judge reads a marker in the result; the fake CI reads the patch ref
  TASK_EXECUTION_QUALITY_GENERAL: (p) => ({ verdict: p.result.includes("[bad]") ? "fails" : p.result.includes("[half]") ? "partially_satisfies" : "satisfies",
    score: p.result.includes("[bad]") ? 2 : 9, reason: p.result.includes("[bad]") ? "the CSV has no totals row" : "meets the task" }),
  LLM_OUTPUT_EVALUATION_GENERAL: (p) => ({ rating: p.output.includes("[bad]") ? "Fails" : "Good", score: 8, strengths: ["clear"], errors: [] }),
  CODE_PATCH_VERIFY_GENERAL: (p) => ({ conclusion: p.patch.endsWith("@red") ? "failure" : p.patch.endsWith("@wip") ? "pending" : "success",
    passed: p.patch.endsWith("@red") ? false : p.patch.endsWith("@wip") ? null : true, commit: p.patch.split("@")[1] }),
};
let failNext = new Set(), emptyNext = new Set(), unrelated = false;
let agentSlow = false, agentAsks = [], agentDone = {};
let rpcUsdt = 400n * 10n ** 6n, staleNext = false;
const srv = http.createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    if (req.url.startsWith("/rpc")) { // fake public RPC: balanceOf -> rpcUsdt, decimals -> 6
      const { params } = JSON.parse(b); const sel = params[0]?.data?.slice(0, 10);
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x" + (sel === "0x313ce567" ? 6n : rpcUsdt).toString(16) }));
    }
    if (req.url.startsWith("/agent/")) { // fake Anjoman agent (API key): a delegated task, sometimes slow (202 + poll)
      res.setHeader("content-type", "application/json");
      if (req.headers.authorization !== "Bearer anjoman_test") { res.writeHead(401); return res.end('{"error":"This API key is not recognised."}'); }
      if (req.url.startsWith("/agent/jobs/")) return res.end(JSON.stringify(agentDone));
      const m = JSON.parse(b);
      agentAsks.push(m);
      if (agentSlow) { res.writeHead(202); return res.end(JSON.stringify({ status: "running", jobId: "job1", conversationId: "c1" })); }
      return res.end(JSON.stringify(agentDone));
    }
    if (req.url.startsWith("/v1/blocks/")) { // fake settled block: epoch 8 recorded, 9 not yet
      const [, , , ep, , h] = req.url.split("/");
      if (ep === "9") { res.writeHead(404, { "content-type": "application/json" }); return res.end('{"error":"no block recorded for this epoch"}'); }
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ deliveries_root: "0xroot", proof: ["0x1"], delivery: { receipt_hash: h, payer: "0xabc", miner_id: "7", intent: h.endsWith("bad") ? "OTHER" : "WALLET_BALANCE_CHECK_GENERAL", usdc: 10000 } }));
    }
    const { intent, params } = JSON.parse(b);
    if (!req.headers["payment-signature"]) {
      const ch = { x402Version: 2, error: "Payment required", resource: { url: "x", description: "", mimeType: "application/json" },
        accepts: [{ scheme: "exact", network: "eip155:84532", amount: "10000", asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
          payTo: "0x72a70e949362670Bf8bceAd24eFC5b8f950aa08b", maxTimeoutSeconds: 60, extra: { name: "USDC", version: "2" } }] };
      res.writeHead(402, { "PAYMENT-REQUIRED": Buffer.from(JSON.stringify(ch)).toString("base64"), "content-type": "application/json" });
      return res.end("{}");
    }
    if (failNext.has(intent) || !answers[intent]) { res.writeHead(503, { "content-type": "application/json" }); return res.end('{"error":"no miner"}'); }
    const rc = { receipt_hash: "0x" + Math.random().toString(16).slice(2).padEnd(64, "0"), tx_hash: "0xfeed", amount_uusdc: 10000, intent, epoch_id: 8 };
    res.writeHead(200, { "X-TELEGRAPH-RECEIPT": Buffer.from(JSON.stringify(rc)).toString("base64"), "content-type": "application/json" });
    if (staleNext && intent === "WALLET_BALANCE_CHECK_GENERAL") { res.end(JSON.stringify({ miner_id: "7", cost_usd: 0.01, result: { address: params.address, balance: 0, token_symbol: "USDT", as_of: "2026-01-01T00:00:00Z" } })); return; }
    const result = unrelated && intent === "WEB_SEARCH_GENERAL" ? { answer: null, brief: null, sources: ["https://coingeek.com/x", "https://hackerone.com/y"] } : emptyNext.has(intent) ? { answer: null, brief: null, sources: [] } : answers[intent](params);
    res.end(JSON.stringify({ miner_id: "7", result, cost_usd: 0.01 }));
  });
});
await new Promise((r) => srv.listen(0, r));
process.env.TELEGRAPH_NODE = `http://127.0.0.1:${srv.address().port}`;
process.env.TELEGRAPH_PAYER_KEY = "0x" + "11".repeat(32);
process.env.GG_LEDGER = path.join(os.tmpdir(), `gg-${Date.now()}.jsonl`);
process.env.GG_RAIL = "x402";  // the fake node speaks the x402 exact challenge
process.env.GG_NO_RPC = "1";  // tests that want the chain cross-check turn it on and point it at the fake RPC
process.env.GG_REUSE = "0";   // likewise for answer reuse
process.env.ANJOMAN_URL = process.env.TELEGRAPH_NODE;
process.env.GG_DELEGATE_POLL_MS = "10";
const g = await import("../src/guards.mjs");
test.after(() => srv.close());

test("scout: reputable client GO, client with non-payment reports CAUTION, malicious link SKIP", async () => {
  assert.equal((await g.scoutBounty({ url: "https://bounties.example/hackathon/x", sponsor: "GoodDAO", prizeUsd: 225 })).verdict, "GO");
  assert.equal((await g.scoutBounty({ url: "https://shadyco.io/bounty", sponsor: "ShadyCo", prizeUsd: 1000 })).verdict, "CAUTION");
  assert.equal((await g.scoutBounty({ url: "https://evil.example/claim", sponsor: "GoodDAO" })).verdict, "SKIP");
});
test("scout: search that never mentions the sponsor is CAUTION, not GO (live shape)", async () => {
  emptyNext = new Set(); unrelated = true;
  const d = await g.scoutBounty({ url: "https://bounties.example/x", sponsor: "QuietCo" });
  unrelated = false;
  assert.equal(d.verdict, "CAUTION");
  assert.match(d.reasons.join(" "), /no independent record/);
});
test("scout: falls back to a second intent when the first has no supply", async () => {
  failNext = new Set(["WEB_SEARCH_GENERAL"]);
  const d = await g.scoutBounty({ url: "https://bounties.example/x", sponsor: "GoodDAO" });
  failNext = new Set();
  assert.equal(d.evidence[1].intent, "NEWS_SEARCH_GENERAL");
  assert.equal(d.receipts.length, 2);
});
test("scout: bad URL refused before any purchase", async () => {
  await assert.rejects(g.scoutBounty({ url: "not a url", sponsor: "x" }));
});
test("claim: unpaid prize produces a claim draft with receipts; paid prize does not", async () => {
  const c = await g.claimPayout({ wallet: WALLET, chain: "ethereum", token: "USDT", sponsor: "ExampleCo", prizeUsd: 400, termsText: "Winners are paid within 30 days.", dueDate: "2026-11-15" });
  assert.equal(c.verdict, "CLAIM");
  assert.match(c.claim, /receipt 0x/);
  assert.equal(c.receipts.length, 2);
  const p = await g.claimPayout({ wallet: WALLET, chain: "ethereum", token: "USDC", sponsor: "GoodDAO", prizeUsd: 400 });
  assert.equal(p.verdict, "PAID");
  assert.equal(p.claim, undefined);
});
test("claim: sponsor's 'sent' tx that reverted is claimed, confirmed one is PAID", async () => {
  assert.equal((await g.claimPayout({ wallet: WALLET, chain: "base", txHash: "0x" + "ab".repeat(31) + "00", sponsor: "X", prizeUsd: 5 })).verdict, "CLAIM");
  assert.equal((await g.claimPayout({ wallet: WALLET, chain: "base", txHash: "0x" + "ab".repeat(32), sponsor: "X", prizeUsd: 5 })).verdict, "PAID");
  await assert.rejects(g.claimPayout({ wallet: "nope", chain: "base" }));
});
test("claim: no proof available -> PENDING, never a claim", async () => {
  failNext = new Set(["WALLET_BALANCE_CHECK_GENERAL"]);
  const d = await g.claimPayout({ wallet: WALLET, chain: "base", token: "USDC", sponsor: "X", prizeUsd: 5 });
  failNext = new Set();
  assert.equal(d.verdict, "PENDING");
  assert.equal(d.claim, undefined);
});
test("ship: null verdict but counted issues is still sent back (live miner shape)", async () => {
  assert.equal((await g.shipCheck("pragma solidity ^0.8.0; contract B { function g() public { nullverdict(); } }")).verdict, "FIX");
});
test("scout: a paid but empty answer falls through to the next supplier", async () => {
  failNext = new Set(); emptyNext = new Set(["WEB_SEARCH_GENERAL"]);
  const d = await g.scoutBounty({ url: "https://bounties.example/x", sponsor: "GoodDAO" });
  emptyNext = new Set();
  assert.equal(d.evidence[1].intent, "NEWS_SEARCH_GENERAL");
  assert.equal(d.evidence[1].tried[0].error, "empty answer");
});
test("ship: tx.origin contract is sent back, clean contract ships", async () => {
  assert.equal((await g.shipCheck("pragma solidity ^0.8.0; contract A { function f() public { require(tx.origin == msg.sender); } }")).verdict, "FIX");
  assert.equal((await g.shipCheck("pragma solidity ^0.8.0; contract A { uint x; }")).verdict, "SHIP");
  await assert.rejects(g.shipCheck("   "));
});
test("ship: no security answer is never SHIP, even when the code review passes (falsum#97, B07); a missing code review only adds uncertainty", async () => {
  failNext = new Set(["SECURITY_REVIEW_GENERAL"]);
  const d = await g.shipCheck("pragma solidity ^0.8.0; contract B { uint y; }");
  failNext = new Set();
  assert.equal(d.verdict, "HOLD"); assert.match(d.reasons.join(" "), /no security review could be bought/);
  failNext = new Set(["CODE_REVIEW_GENERAL"]);
  const e = await g.shipCheck("pragma solidity ^0.8.0; contract C { uint z; }");
  failNext = new Set();
  assert.equal(e.verdict, "SHIP"); assert.ok(e.uncertainty.includes("only one review could be bought"));
});
test("every decision carries receipts and the ledger page renders", async () => {
  const { readLedger } = await import("../src/ledger.mjs");
  const ds = readLedger().filter((e) => e.kind === "decision" && e.verdict !== "PENDING");
  assert.ok(ds.length >= 9 && ds.every((d) => d.receipts.length >= 1));
  const { writeLedgerPage } = await import("../src/page.mjs");
  writeLedgerPage(path.join(os.tmpdir(), "gg.html"));
});

test("claim: BSC is asked by token contract (symbol answers come back null), unknown chain is PENDING", async () => {
  const d = await g.claimPayout({ wallet: WALLET, chain: "BNB Smart Chain", token: "USDT", sponsor: "Prize B", prizeUsd: 800 });
  assert.equal(d.verdict, "CLAIM");
  assert.match(d.reasons[0], /holds 500 /);
  const u = await g.claimPayout({ wallet: WALLET, chain: "tron", token: "USDT", sponsor: "Prize C", prizeUsd: 50 });
  assert.equal(u.verdict, "PENDING");
  assert.match(u.reasons[0], /likely unsupported/);
  assert.equal(u.claim, undefined);
});
test("public page and export never show sponsor names, prize wallets or sponsor links", async () => {
  await g.scoutBounty({ url: "https://acmezeta.example/bounty", sponsor: "Acme Zeta", prizeUsd: 400 });
  await g.claimPayout({ wallet: "0x2222222222222222222222222222222222222222", chain: "ethereum", token: "USDT", sponsor: "Acme Zeta", prizeUsd: 400, label: "Prize A" });
  const fs = await import("node:fs");
  const { publicLedger } = await import("../src/redact.mjs");
  const { writeLedgerPage } = await import("../src/page.mjs");
  const out = path.join(os.tmpdir(), `gg-pub-${Date.now()}.html`);
  writeLedgerPage(out);
  const pub = JSON.stringify(publicLedger()) + fs.readFileSync(out, "utf8");
  for (const bad of [/zeta/i, /acme/i, /2222222222222222222222222222222222222222/i, /Winners are paid/, /To: /]) assert.doesNotMatch(pub, bad);
  assert.match(pub, /Client [A-Z]|Prize A|Payment A/);
  assert.match(pub, /receipt_hash|receipt <code>0x/); // receipts stay verifiable
});

test("reuse: the same fresh question is answered from the ledger, not paid twice", async () => {
  process.env.GG_REUSE = "1";
  const { readLedger } = await import("../src/ledger.mjs");
  const paid = () => readLedger().filter((e) => e.kind === "purchase").length;
  await g.scoutBounty({ url: "https://reuse.example/x", sponsor: "ReuseDAO" });
  const n = paid();
  const d = await g.scoutBounty({ url: "https://reuse.example/x", sponsor: "ReuseDAO" });
  process.env.GG_REUSE = "0";
  assert.equal(paid(), n);
  assert.equal(d.cost_usd, 0);
  assert.ok(d.evidence.every((e) => e.reused));
});
test("claim: a free chain read overrules a wrong miner balance and says so", async () => {
  process.env.GG_NO_RPC = "0"; process.env.GG_RPC_ETHEREUM = `${process.env.TELEGRAPH_NODE}/rpc`;
  const d = await g.claimPayout({ wallet: WALLET, chain: "ethereum", token: "USDT", sponsor: "Prize D", prizeUsd: 400 });
  rpcUsdt = 0n;
  const c = await g.claimPayout({ wallet: WALLET, chain: "ethereum", token: "USDT", sponsor: "Prize D", prizeUsd: 400 });
  process.env.GG_NO_RPC = "1"; rpcUsdt = 400n * 10n ** 6n;
  assert.equal(d.verdict, "PAID");                       // miner said 0, chain says 400
  assert.match(d.uncertainty.join(" "), /disagrees with the chain/);
  assert.equal(c.verdict, "CLAIM");
  assert.match(c.reasons.join(" "), /chain read agrees/);
  assert.match(c.claim, /independent chain read/);
});
test("claim: consent. No approval -> waits; declined -> not sent and no letter kept", async () => {
  const w = await g.claimPayout({ wallet: WALLET, chain: "ethereum", token: "USDT", sponsor: "Prize E", prizeUsd: 400 });
  assert.equal(w.action, "awaiting user approval");
  const n = await g.claimPayout({ wallet: WALLET, chain: "ethereum", token: "USDT", sponsor: "Prize E", prizeUsd: 400, approved: false });
  assert.equal(n.action, "declined by user: not sent");
  assert.equal(n.claim, undefined);
  const y = await g.claimPayout({ wallet: WALLET, chain: "ethereum", token: "USDT", sponsor: "Prize E", prizeUsd: 400, approved: true });
  assert.match(y.action, /^approved/);
});
test("claim: a stale balance reading is not evidence", async () => {
  staleNext = true;
  const d = await g.claimPayout({ wallet: WALLET, chain: "ethereum", token: "USDT", sponsor: "Prize F", prizeUsd: 400 });
  staleNext = false;
  assert.equal(d.verdict, "PENDING");
  assert.match(JSON.stringify(d.evidence), /stale answer/);
});
test("ship: miner findings are corroborated by local rules, or marked miner-only", async () => {
  const v = await g.shipCheck("pragma solidity ^0.8.0; contract A { function f() public { require(tx.origin == msg.sender); } }");
  assert.match(v.reasons.join(" "), /confirmed by local rules: tx.origin/);
  const m = await g.shipCheck("pragma solidity ^0.8.0; contract B { function g() public { nullverdict(); } }");
  assert.equal(m.verdict, "FIX");
  assert.match(m.uncertainty.join(" "), /miner-only/);
});
test("verify: receipts are checked against the node's epoch blocks", async () => {
  const { verifyReceipt } = await import("../src/verify.mjs");
  assert.equal((await verifyReceipt({ receipt_hash: "0xaa", epoch_id: 8, intent: "WALLET_BALANCE_CHECK_GENERAL", amount_uusdc: 10000 })).status, "SETTLED");
  assert.equal((await verifyReceipt({ receipt_hash: "0xbad", epoch_id: 8, intent: "WALLET_BALANCE_CHECK_GENERAL", amount_uusdc: 10000 })).status, "MISMATCH");
  assert.equal((await verifyReceipt({ receipt_hash: "0xaa", epoch_id: 9 })).status, "PENDING");
});

test("scout: a delegated sponsor investigation (API key) adds sourced evidence, is capped, and only counts with sources", async () => {
  process.env.ANJOMAN_API_KEY = "anjoman_test";
  try {
    unrelated = true; // the paid search finds nothing about the sponsor
    agentDone = { status: "complete", jobId: "job1", conversationId: "c1", costUsd: 0.03, answer: "QuietCo paid its 2025 hackathon winners within three weeks.",
      sources: [{ url: "https://blog.quietco.example/winners-paid" }], steps: [{ receipt: { receipt_hash: "0x" + "ab".repeat(32) } }] };
    agentSlow = true; // first reply is 202, then the job is polled
    const d = await g.scoutBounty({ url: "https://bounties.example/x", sponsor: "QuietCo" });
    assert.equal(d.verdict, "GO", JSON.stringify(d.reasons));
    assert.equal(agentAsks.at(-1).maxSpendUsd, 0.05);
    assert.ok(Math.abs(d.cost_usd - 0.05) < 1e-9, `cost ${d.cost_usd}`); // 2 x $0.01 + $0.03 delegated
    const inv = d.evidence.find((e) => e.intent === "ANJOMAN_AGENT_TASK");
    assert.equal(inv.job_id, "job1");
    agentSlow = false;
    agentDone = { status: "complete", jobId: "job2", costUsd: 0.02, answer: "QuietCo is well known for paying winners.", sources: [] }; // no sources
    assert.equal((await g.scoutBounty({ url: "https://bounties.example/x", sponsor: "QuietCo" })).verdict, "CAUTION");
    agentDone = { status: "failed", jobId: "job3", costUsd: 0, answer: "Insufficient balance." };
    const f = await g.scoutBounty({ url: "https://bounties.example/x", sponsor: "QuietCo" });
    assert.equal(f.verdict, "CAUTION");
    assert.match(f.reasons.join(" "), /delegated sponsor investigation unavailable \(delegated task failed\)/);
    process.env.ANJOMAN_API_KEY = "anjoman_wrong";
    const w = await g.scoutBounty({ url: "https://bounties.example/x", sponsor: "QuietCo" });
    assert.match(w.reasons.join(" "), /HTTP 401/);
  } finally { delete process.env.ANJOMAN_API_KEY; unrelated = false; agentSlow = false; }
});

const TASK = "Export November invoices to CSV with a totals row.";
test("deliver: satisfied task is SUBMIT; failed is FIX with the judge's reason; partial is HOLD", async () => {
  const ok = await g.deliverCheck({ task: TASK, result: "invoice,amount\nA,1\ntotal,1" });
  assert.equal(ok.verdict, "SUBMIT");
  assert.equal(ok.receipts.length, 1);
  const bad = await g.deliverCheck({ task: TASK, result: "invoice,amount\nA,1 [bad]" });
  assert.equal(bad.verdict, "FIX");
  assert.match(bad.reasons.join(" "), /fails.*totals row/);
  assert.equal((await g.deliverCheck({ task: TASK, result: "invoice,amount [half]" })).verdict, "HOLD");
});
test("deliver: a required item missing from the result is FIX even when the judge passes it, shown as uncertainty", async () => {
  const d = await g.deliverCheck({ task: TASK, result: "invoice,amount\nA,1", mustInclude: ["total"] });
  assert.equal(d.verdict, "FIX");
  assert.match(d.uncertainty.join(" "), /judge passed it/);
});
test("deliver: CI on the patch decides too: failure FIX, pending HOLD, success SUBMIT", async () => {
  assert.equal((await g.deliverCheck({ task: TASK, result: "done, totals added", patch: "acme/app@red" })).verdict, "FIX");
  assert.equal((await g.deliverCheck({ task: TASK, result: "done, totals added", patch: "acme/app@wip" })).verdict, "HOLD");
  const s = await g.deliverCheck({ task: TASK, result: "done, totals added", patch: "acme/app@abc123" });
  assert.equal(s.verdict, "SUBMIT");
  assert.equal(s.receipts.length, 2);
});
test("deliver: falls back to LLM_OUTPUT_EVALUATION; no judge at all is HOLD (fail closed); too long is HOLD with nothing paid", async () => {
  failNext = new Set(["TASK_EXECUTION_QUALITY_GENERAL"]);
  const f = await g.deliverCheck({ task: TASK, result: "invoice,amount\ntotal,1" });
  assert.equal(f.evidence[0].intent, "LLM_OUTPUT_EVALUATION_GENERAL");
  assert.equal(f.verdict, "SUBMIT");
  failNext = new Set(["TASK_EXECUTION_QUALITY_GENERAL", "LLM_OUTPUT_EVALUATION_GENERAL"]);
  assert.equal((await g.deliverCheck({ task: TASK, result: "x" })).verdict, "HOLD");
  failNext = new Set();
  const long = await g.deliverCheck({ task: TASK, result: "x".repeat(5000) });
  assert.equal(long.verdict, "HOLD");
  assert.equal(long.receipts.length, 0);
  await assert.rejects(g.deliverCheck({ task: "", result: "x" }));
});

