// Mission 09 "tests worth demonstrating", run offline against a fake Telegraph node and a fake RPC (no network, no funds):
// stale local answer, no budget, failed payment, conflicting provider answer, and explicit permission for external effects.
// The gates, policy, ledger and escrow client are the real ones; only the node and the chain are fakes.
//   node examples/m09-demos.mjs            (prints the transcript kept in docs/M09-DEMOS.md)
import http from "node:http";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

let balance = 1000000, unbilled = 0, requests = 0;
const judge = (p) => ({ verdict: "satisfies", score: 9, reason: "the CSV has a totals row" });
const answers = {
  TASK_EXECUTION_QUALITY_GENERAL: judge,
  WALLET_BALANCE_CHECK_GENERAL: (p) => ({ address: p.address, balance: 400, token_symbol: "USDT", as_of: new Date().toISOString() }),
};
const srv = http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
    res.setHeader("content-type", "application/json");
    if (req.url.startsWith("/rpc")) { // the chain says the wallet holds 0 USDT (6 decimals)
      const sel = JSON.parse(b).params[0]?.data?.slice(0, 10);
      return res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result: sel === "0x313ce567" ? "0x6" : "0x0" }));
    }
    const { intent, params, max_budget_usdc } = JSON.parse(b); const price = Number(max_budget_usdc || 10000);
    const ch = { accepts: [{ scheme: "escrow", network: "eip155:11155111", payTo: "0x72a7", amount: String(price),
      extra: { message: `Telegraph Escrow Payment\nWallet: {from}\nAmount: ${price} uUSDC\nNonce: {nonce}\nValid After: {validAfter}\nValid Before: {validBefore}` } }] };
    if (!req.headers["x-payment"]) { res.writeHead(402); return res.end(JSON.stringify(ch)); }
    requests++;
    if (unbilled + price > balance) { res.writeHead(402); return res.end(JSON.stringify({ ...ch, error: "payment required",
      reason: `insufficient escrow for delivery: unbilled=${unbilled} μUSDC + price=${price} μUSDC > balance=${balance} μUSDC` })); }
    unbilled += price;
    const rc = { receipt_hash: "0xdemo" + String(requests).padStart(4, "0"), amount_uusdc: 10000, intent, epoch_id: 1 };
    res.writeHead(200, { "X-TELEGRAPH-RECEIPT": Buffer.from(JSON.stringify(rc)).toString("base64") });
    res.end(JSON.stringify({ miner_id: "7", cost_usd: 0.01, result: answers[intent](params) }));
  });
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${srv.address().port}`;
const ledger = path.join(os.tmpdir(), `gg-m09-${process.pid}.jsonl`);
Object.assign(process.env, { TELEGRAPH_NODE: base, GG_RPC_ETHEREUM: `${base}/rpc`, TELEGRAPH_PAYER_KEY: "0x" + "11".repeat(32),
  GG_LEDGER: ledger, GG_RAIL: "escrow", GG_MAX_PER_DAY: "100000" });
const g = await import("../src/guards.mjs");
const { append } = await import("../src/ledger.mjs");
const W = "0x3333333333333333333333333333333333333333";
const show = (title, lines) => console.log(`\n## ${title}\n` + lines.map((l) => `- ${l}`).join("\n"));
const short = (d) => `${d.verdict}; ${d.reasons.join(" | ")}${d.uncertainty?.length ? `; uncertainty: ${d.uncertainty.join(" | ")}` : ""}`;

// 1. Stale local answer: the ledger already holds a balance answer, but it is 25 minutes old (TTL 10 min), so it is not reused.
append({ kind: "purchase", intent: "WALLET_BALANCE_CHECK_GENERAL", params: { address: W, chain: "ethereum", token: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
  purpose: "claim", result: { balance: 400, as_of: new Date(Date.now() - 25 * 60000).toISOString() }, receipt: { receipt_hash: "0xold" }, amount_uusdc: 0 });
const ts = new Date(Date.now() - 25 * 60000).toISOString();
fs.writeFileSync(ledger, fs.readFileSync(ledger, "utf8").replace(/"ts":"[^"]+"/, `"ts":"${ts}"`));
let n = requests; const c1 = await g.claimPayout({ wallet: W, chain: "ethereum", token: "USDT", sponsor: "ExampleCo", prizeUsd: 400 });
show("1. Stale local answer: not reused, bought fresh, then checked against the chain", [
  "ledger holds a 25-minute-old balance answer for this wallet (reuse TTL for balances: 10 min)",
  `paid requests sent: ${requests - n} (fresh answer, receipt ${c1.receipts[0]})`, `decision: ${short(c1)}`]);

// 2. Conflicting provider answer: the miner says 400 USDT, the chain says 0. The chain wins and the conflict is shown.
show("2. Conflicting provider answer (same run)", [`miner: 400 USDT; free chain read: 0 USDT; the chain value is used and the conflict is listed as uncertainty`,
  `letter drafted: ${c1.claim ? "yes" : "no"}; action: ${c1.action}`]);
n = requests; const d2 = await g.deliverCheck({ task: "Add a totals row to the CSV", result: "invoice,amount\nA,1", mustInclude: ["total"], name: "demo" });
show("2b. Conflicting answers on a deliverable: the paid judge passes it, the client's required item is missing", [`decision: ${short(d2)}`]);

// 3. Explicit permission for external effects: a claim letter is never sent without the user's yes.
const c3 = await g.claimPayout({ wallet: W, chain: "ethereum", token: "USDT", sponsor: "ExampleCo", prizeUsd: 400, approved: false });
show("3. Permission for external effects", [`no answer from the user: action "${c1.action}"`, `user said no: action "${c3.action}", letter kept: ${c3.claim ? "yes" : "no"}`,
  "Gig Guard itself never sends anything; only an approved letter is handed to the mailer."]);

// 4. Failed payment: the prepaid escrow balance is used up. The node refuses the signed request.
balance = unbilled + 5000; n = requests;
const dec0 = fs.readFileSync(ledger, "utf8").split("\n").filter((l) => l.includes('"kind":"decision"')).length;
let e4; try { await g.deliverCheck({ task: "Add a totals row to the CSV", result: "invoice,amount\nA,1\ntotal,1", name: "demo-402" }); } catch (e) { e4 = e; }
const dec1 = fs.readFileSync(ledger, "utf8").split("\n").filter((l) => l.includes('"kind":"decision"')).length;
show("4. Failed payment (escrow exhausted)", [`node: 402 ${e4?.message}`, `error type: ${e4?.name}; shortfall ${e4?.info?.shortfall} μUSDC`,
  `paid requests tried: ${requests - n} (no fallback purchase); decisions logged: ${dec1 - dec0} (no false HOLD); an eval run stops here with exit code 3`]);

// 5. No budget: today's spend is at the daily cap. Refused before anything is signed or sent.
balance = 10 ** 9; append({ kind: "purchase", intent: "X", amount_uusdc: 95000, cost_usd: 0.095 }); n = requests;
let e5; try { await g.deliverCheck({ task: "Add a totals row to the CSV", result: "invoice,amount\nA,1\ntotal,1", name: "demo-budget" }); } catch (e) { e5 = e; }
show("5. No budget (daily cap $0.10 in this demo; default $1.00)", [`${e5?.name}: ${e5?.message}`, `requests that reached the node: ${requests - n}`]);
srv.close(); fs.rmSync(ledger, { force: true });
