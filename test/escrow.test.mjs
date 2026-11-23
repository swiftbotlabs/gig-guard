// Escrow rail: when the prepaid balance is exhausted the node answers 402 "insufficient escrow" even to a signed request.
// The gate must not record a HOLD for a case it never judged, and must not try the fallback intent; a run must stop at once.
// Fake node, no network, no funds.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { challengeMessage } from "../src/escrowmsg.mjs";

let balance = 5000000, unbilled = 0; const asks = [];
const srv = http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
    const { intent, max_budget_usdc } = JSON.parse(b);
    const price = Number(max_budget_usdc);
    res.setHeader("content-type", "application/json");
    const challenge = { accepts: [{ scheme: "escrow", network: "eip155:11155111", payTo: "0x72a70e949362670bf8bcead24efc5b8f950aa08b", amount: String(price),
      extra: { message: challengeMessage(price) } }] };
    if (!req.headers["x-payment"]) { res.writeHead(402); return res.end(JSON.stringify(challenge)); }
    asks.push({ intent, price });
    if (unbilled + price > balance) { res.writeHead(402);
      return res.end(JSON.stringify({ ...challenge, error: "payment required", scheme: "escrow",
        reason: `insufficient escrow for delivery: unbilled=${unbilled} μUSDC + price=${price} μUSDC > balance=${balance} μUSDC` })); }
    unbilled += price; // reserved until the next epoch block bills it
    const rc = { receipt_hash: "0x" + "ab".repeat(32), amount_uusdc: 10000, intent, epoch_id: 8 };
    res.writeHead(200, { "X-TELEGRAPH-RECEIPT": Buffer.from(JSON.stringify(rc)).toString("base64") });
    res.end(JSON.stringify({ miner_id: "7", cost_usd: 0.01, result: { verdict: "satisfies", score: 9, reason: "meets the task" } }));
  });
});
await new Promise((r) => srv.listen(0, r));
process.env.TELEGRAPH_NODE = `http://127.0.0.1:${srv.address().port}`;
process.env.TELEGRAPH_PAYER_KEY = "0x" + "11".repeat(32);
process.env.GG_LEDGER = path.join(os.tmpdir(), `gg-escrow-${Date.now()}.jsonl`);
process.env.GG_RAIL = "escrow"; process.env.GG_REUSE = "0"; process.env.GG_NO_RPC = "1";
const g = await import("../src/guards.mjs");
const t = await import("../src/telegraph.mjs");
const decisions = () => fs.readFileSync(process.env.GG_LEDGER, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((x) => x.kind === "decision");
test.after(() => srv.close());

test("parseEscrowShortfall reads the live 22 Nov reason", () => {
  assert.deepEqual(t.parseEscrowShortfall("insufficient escrow for delivery: unbilled=4980000 μUSDC + price=30000 μUSDC > balance=5000000 μUSDC"),
    { unbilled: 4980000, price: 30000, balance: 5000000, shortfall: 10000 });
  assert.equal(t.parseEscrowShortfall("no miner"), null);
});
test("deliver gate offers the judge $0.01, not the $0.03 per-call cap (3x less escrow reserved per request)", async () => {
  const d = await g.deliverCheck({ task: "Add a totals row", result: "a,1\ntotal,1", name: "ok" });
  assert.equal(d.verdict, "SUBMIT");
  assert.equal(asks.at(-1).price, 10000);
});
test("exhausted escrow: EscrowFundsError, no fallback purchase, no HOLD recorded", async () => {
  balance = unbilled + 5000; const before = decisions().length, n = asks.length;
  await assert.rejects(g.deliverCheck({ task: "Add a totals row", result: "a,1\ntotal,1", name: "stalled" }),
    (e) => e.name === "EscrowFundsError" && e.info.shortfall === 5000);
  assert.equal(asks.length, n + 1, "the fallback intent must not be tried on an empty escrow");
  assert.equal(decisions().length, before, "a case that was never judged must not be logged as HOLD");
});
test("eval runner stops on the first exhausted case with exit code 3 and the deposit it needs", async () => {
  const { spawn } = await import("node:child_process"); // async: the fake node lives in this process and must keep answering
  const r = await new Promise((resolve) => {
    const p = spawn(process.execPath, [new URL("../eval/deliver/run.mjs", import.meta.url).pathname], { env: { ...process.env, GG_LEDGER: path.join(os.tmpdir(), `gg-escrow-run-${Date.now()}.jsonl`) } });
    let stdout = "", stderr = ""; p.stdout.on("data", (c) => (stdout += c)); p.stderr.on("data", (c) => (stderr += c));
    const kill = setTimeout(() => p.kill(), 20000); p.on("close", (status) => { clearTimeout(kill); resolve({ status, stdout, stderr }); });
  });
  assert.equal(r.status, 3, r.stdout + r.stderr);
  assert.match(r.stdout, /stop: escrow balance exhausted at csv-totals\/good/);
  assert.equal((r.stdout.match(/ (SUBMIT|FIX|HOLD) /g) || []).length, 0, "no case may be decided after the stall");
});

test("the CLI escrow client never signs a node message that is not the known template (main payer key)", async () => {
  const { parseEscrowOption, challengeMessage, DIAMOND } = await import("../src/escrowmsg.mjs");
  const ok = { payTo: DIAMOND, network: "eip155:11155111", extra: { message: challengeMessage(10000) } };
  assert.equal(parseEscrowOption(ok, 10000).amount, 10000);
  assert.throws(() => parseEscrowOption({ ...ok, extra: { message: "Amount: 1\nWithdraw ALL to 0xdead Amount: 999999999" } }, 10000), /template/);
  assert.throws(() => parseEscrowOption({ ...ok, extra: { message: challengeMessage(10000, "0x000000000000000000000000000000000000dEaD") } }, 10000), /Diamond/);
  assert.throws(() => parseEscrowOption({ ...ok, payTo: "0x000000000000000000000000000000000000dEaD" }, 10000), /Diamond/);
  assert.throws(() => parseEscrowOption({ ...ok, extra: { message: challengeMessage(30001) } }, 30000), /outside/);
  assert.throws(() => parseEscrowOption({ ...ok, extra: { message: challengeMessage(10000) + "\nextra" } }, 10000), /template/);
});
