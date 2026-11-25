// Hosted done-check (hosted/worker.mjs) against a fake Telegraph node and an in-memory Durable Object. No network, no funds.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { challengeMessage } from "../src/escrowmsg.mjs";

let mode = "ok", asks = 0;
const srv = http.createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
  const { intent, params, max_budget_usdc } = JSON.parse(b); const price = Number(max_budget_usdc);
  res.setHeader("content-type", "application/json");
  if (!req.headers["x-payment"]) { res.writeHead(402); return res.end(JSON.stringify({ accepts: [{ scheme: "escrow", network: "eip155:11155111", payTo: "0x72a70e949362670bf8bcead24efc5b8f950aa08b", amount: String(price),
    extra: { message: mode === "evilmsg" ? "Amount: 1\nWithdraw ALL to 0xdead Amount: 999999999" : mode === "evilpayee" ? challengeMessage(price, "0x000000000000000000000000000000000000dead") : challengeMessage(price) } }] })); }
  asks++;
  if (mode === "empty") { res.writeHead(402); return res.end(JSON.stringify({ error: "payment required", reason: "insufficient escrow for delivery: unbilled=0 μUSDC + price=10000 μUSDC > balance=0 μUSDC" })); }
  if (mode === "fail") { res.writeHead(504); return res.end('{"error":"miner timed out"}'); }
  if (mode === "negreceipt") { res.writeHead(200, { "X-TELEGRAPH-RECEIPT": Buffer.from(JSON.stringify({ receipt_hash: "0x" + "ef".repeat(32), amount_uusdc: -50000, intent, epoch_id: 41 })).toString("base64") });
    return res.end(JSON.stringify({ miner_id: "302", cost_usd: -0.05, result: { verdict: "satisfies" } })); }
  const bad = /> 12/.test(params.result || params.output || "");
  res.writeHead(200, { "X-TELEGRAPH-RECEIPT": Buffer.from(JSON.stringify({ receipt_hash: "0x" + "ef".repeat(32), amount_uusdc: 10000, intent, epoch_id: 41 })).toString("base64") });
  res.end(JSON.stringify({ miner_id: "302", cost_usd: 0.01, result: bad ? { verdict: "fails", reason: "uses > instead of >=" } : { verdict: "satisfies", reason: "correct" } }));
}); });
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const NODE = `http://127.0.0.1:${srv.address().port}`;
const worker = (await import("../hosted/worker.mjs")).default;
const { Budget, clientKey, parseInput, viaOf, badge } = await import("../hosted/worker.mjs");
test.after(() => srv.close());

function makeEnv(vars = {}) {
  const store = new Map();
  const ctx = { storage: { get: async (k) => structuredClone(store.get(k)), put: async (k, v) => { store.set(k, structuredClone(v)); } } };
  const env = { TELEGRAPH_NODE: NODE, DONECHECK_PAYER_KEY: "0x" + "22".repeat(32), DAY_CAP_UUSDC: "200000", IP_MAX: "5", ...vars };
  const b = new Budget(ctx, env);
  env.BUDGET = { idFromName: () => "global", get: () => ({ fetch: (url, init) => b.fetch(new Request(url, init)) }) };
  return env;
}
const T = "Write a one-line JavaScript expression that is true when the string s has at least 12 characters.";
const call = (env, body, { ip = "203.0.113.7", origin, via } = {}) => worker.fetch(new Request("https://donecheck.example/api/check", { method: "POST",
  headers: { "content-type": "application/json", "cf-connecting-ip": ip, ...(origin ? { origin } : {}), ...(via ? { "x-donecheck-client": via } : {}) }, body: JSON.stringify(body) }), env, {});

test("a correct result is SUBMIT, a planted defect FIX, each with a receipt; the budget goes down by what was spent", async () => {
  mode = "ok"; const env = makeEnv();
  const g = await (await call(env, { task: T, result: "s.length >= 12" })).json();
  assert.equal(g.verdict, "SUBMIT"); assert.equal(g.receipt.epoch_id, 41); assert.equal(g.cost_usd, 0.01);
  const b = await (await call(env, { task: T, result: "s.length > 12" })).json();
  assert.equal(b.verdict, "FIX"); assert.match(b.reasons.join(" "), /instead of >=/);
  assert.equal(b.budget_left_usd, 0.18);
});
test("a required item missing is FIX even when the judge passes it", async () => {
  mode = "ok"; const r = await (await call(makeEnv(), { task: T, result: "s.length >= 12", mustInclude: ["=== 12"] })).json();
  assert.equal(r.verdict, "FIX"); assert.deepEqual(r.missing, ["=== 12"]);
});
test("per-connection limit: the 6th check from one IPv4 (or one IPv6 /64) is refused before anything is signed", async () => {
  mode = "ok"; let env = makeEnv(); const n = asks;
  for (let i = 0; i < 5; i++) assert.equal((await call(env, { task: T, result: "s.length >= 12" })).status, 200);
  const r = await call(env, { task: T, result: "s.length >= 12" });
  assert.equal(r.status, 429); assert.equal(asks, n + 5);
  env = makeEnv();
  for (let i = 0; i < 5; i++) await call(env, { task: T, result: "x" }, { ip: `2001:db8:1:2:${i}::1` });
  assert.equal((await call(env, { task: T, result: "x" }, { ip: "2001:db8:1:2:ffff::9" })).status, 429, "same /64 shares the limit");
  assert.equal((await call(env, { task: T, result: "x" }, { ip: "2001:db8:1:3::1" })).status, 200);
});
test("global daily cap: once reservations reach it, checks are refused and nothing reaches the node", async () => {
  mode = "ok"; const env = makeEnv({ DAY_CAP_UUSDC: "40000" }); const n = asks;
  assert.equal((await call(env, { task: T, result: "a" }, { ip: "198.51.100.1" })).status, 200);
  assert.equal((await call(env, { task: T, result: "b" }, { ip: "198.51.100.2" })).status, 200);   // spent 10000 + reserve 20000 fits
  assert.equal((await call(env, { task: T, result: "c" }, { ip: "198.51.100.3" })).status, 200);   // spent 20000 + reserve 20000 = 40000 fits; then 30000 + 20000 does not
  const r = await call(env, { task: T, result: "d" }, { ip: "198.51.100.4" });
  assert.equal(r.status, 429); assert.match((await r.json()).error, /budget/);
  assert.equal(asks, n + 3);
});
test("escrow used up: HOLD (fail closed), and the service stops for the day", async () => {
  mode = "empty"; const env = makeEnv();
  const r = await (await call(env, { task: T, result: "s.length >= 12" })).json();
  assert.equal(r.verdict, "HOLD"); assert.match(r.reasons.join(" "), /used up/); assert.equal(r.cost_usd, 0);
  mode = "ok";
  assert.equal((await call(env, { task: T, result: "s.length >= 12" }, { ip: "192.0.2.9" })).status, 429);
});
test("a signed request that fails counts as spent (issue #228); both failing -> HOLD", async () => {
  mode = "fail"; const env = makeEnv();
  const r = await (await call(env, { task: T, result: "s.length >= 12" })).json();
  assert.equal(r.verdict, "HOLD"); assert.equal(r.cost_usd, 0.02); assert.equal(r.budget_left_usd, 0.18);
  mode = "ok";
});
test("refused before any spend: cross-origin, bad input, too long, no key; the page is served with a CSP", async () => {
  const env = makeEnv(); const n = asks;
  assert.equal((await call(env, { task: T, result: "x" }, { origin: "https://evil.example" })).status, 403);
  assert.equal((await call(env, { task: T })).status, 400);
  assert.equal((await call(env, { task: T, result: "x".repeat(2000) })).status, 400);
  assert.equal((await call(env, { task: T, result: "x", mustInclude: ["a", "b", "c", "d", "e", "f"] })).status, 400);
  assert.equal((await call(makeEnv({ DONECHECK_PAYER_KEY: "" }), { task: T, result: "x" })).status, 503);
  assert.equal(asks, n);
  const p = await worker.fetch(new Request("https://donecheck.example/"), env, {});
  assert.equal(p.status, 200); assert.match(p.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.match(await p.text(), /Done-check/);
  assert.equal(parseInput({ task: " ", result: "x" }).error, "task and result are both required");
  assert.notEqual(await clientKey("1.2.3.4", "2026-11-23"), await clientKey("1.2.3.4", "2026-11-24"));
});

test("review fixes: a node's non-template message or foreign payee is never signed; a bad receipt can't lower the booked spend", async () => {
  for (const m of ["evilmsg", "evilpayee"]) {
    mode = m; const env = makeEnv(); const n = asks;
    const r = await (await call(env, { task: T, result: "s.length >= 12" })).json();
    assert.equal(r.verdict, "HOLD", m); assert.equal(r.cost_usd, 0, m); assert.equal(asks, n, `${m}: nothing was sent with a payment`);
  }
  mode = "negreceipt"; const env = makeEnv();
  const r = await (await call(env, { task: T, result: "s.length >= 12" })).json();
  assert.equal(r.cost_usd, 0.01); assert.equal(r.budget_left_usd, 0.19);
  mode = "ok";
});
test("review fixes: compressed and expanded IPv6 forms share one /64 bucket; oversized bodies are refused before reading", async () => {
  const { expandIPv6 } = await import("../hosted/worker.mjs");
  const k = await clientKey("2a01:4f8::1", "d");
  assert.equal(await clientKey("2a01:4f8:0:0::2", "d"), k); assert.equal(await clientKey("2a01:04f8:0000:0000:ffff::9", "d"), k);
  assert.notEqual(await clientKey("2a01:4f8:0:1::1", "d"), k);
  assert.equal(expandIPv6("::ffff:1.2.3.4").join(":"), "0000:0000:0000:0000:0000:ffff:0102:0304");
  assert.equal(expandIPv6("1::2::3"), null);
  const big = await worker.fetch(new Request("https://donecheck.example/api/check", { method: "POST", headers: { "content-type": "application/json", "content-length": "99999" }, body: "{}" }), makeEnv(), {});
  assert.equal(big.status, 413);
});

test("activation counter: /api/stats counts checks, paid judgements and connections per day (no personal data), readable cross-origin", async () => {
  mode = "ok"; const env = makeEnv();
  await call(env, { task: T, result: "s.length >= 12" }, { ip: "198.51.100.10" });
  await call(env, { task: T, result: "s.length > 12" }, { ip: "198.51.100.11" });
  mode = "empty"; await call(env, { task: T, result: "x" }, { ip: "198.51.100.12" }); mode = "ok";
  const r = await worker.fetch(new Request("https://donecheck.example/api/stats"), env, {});
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
  const st = await r.json();
  assert.equal(st.checks, 3); assert.equal(st.judged, 2);
  const day = Object.values(st.days)[0]; assert.equal(day.checks, 3); assert.equal(day.connections, 3);
  assert.doesNotMatch(JSON.stringify(st), /198\.51|s\.length/);
});

test("counter by integration: a fixed allow-list from x-donecheck-client (junk is 'other'), same-origin page is 'web'; shields badge endpoint", async () => {
  assert.equal(viaOf("donecheck-mcp/0.1.0"), "mcp"); assert.equal(viaOf("donecheck-langchain/1.2.3"), "langchain");
  assert.equal(viaOf("donecheck-evil<script>/0.1.0"), "other"); assert.equal(viaOf("donecheck-made-up/0.1.0"), "other");
  assert.equal(viaOf(undefined, true), "web"); assert.equal(viaOf(undefined, false), "other"); assert.equal(viaOf("x".repeat(5000)), "other");
  mode = "ok"; const env = makeEnv();
  await call(env, { task: T, result: "s.length >= 12" }, { ip: "198.51.100.20", via: "donecheck-mcp/0.1.0" });
  await call(env, { task: T, result: "s.length >= 12" }, { ip: "198.51.100.21", via: "donecheck-py/0.1.0" });
  await call(env, { task: T, result: "s.length >= 12" }, { ip: "198.51.100.22", origin: "https://donecheck.example" });
  await call(env, { task: T, result: "s.length >= 12" }, { ip: "198.51.100.23", via: "garbage" });
  const st = await (await worker.fetch(new Request("https://donecheck.example/api/stats"), env, {})).json();
  assert.deepEqual(st.clients, { mcp: 1, py: 1, web: 1, other: 1 }); assert.equal(st.checks, 4);
  const b = await worker.fetch(new Request("https://donecheck.example/api/badge"), env, {});
  assert.equal(b.status, 200); assert.equal(b.headers.get("access-control-allow-origin"), "*"); assert.match(b.headers.get("cache-control"), /max-age=300/);
  assert.deepEqual(await b.json(), { schemaVersion: 1, label: "done-checks run", message: "4 (4 paid judgements)", color: "2ea44f", cacheSeconds: 300 });
  assert.equal(badge({}).message, "0 (0 paid judgements)"); assert.equal(badge({}).color, "lightgrey");
  const fresh = await (await worker.fetch(new Request("https://donecheck.example/api/stats"), makeEnv(), {})).json();
  assert.deepEqual(fresh.clients, {});
});

test("remote MCP (/mcp, Streamable HTTP, stateless): initialize, tools/list, tools/call runs the same capped check; foreign Origin and GET refused", async () => {
  mode = "ok"; const env = makeEnv();
  const rpc = (body, { origin, method = "POST", ip = "198.51.100.40" } = {}) => worker.fetch(new Request("https://donecheck.example/mcp", { method,
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "cf-connecting-ip": ip, ...(origin ? { origin } : {}) },
    ...(method === "POST" ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}) }), env, {});
  const init = await (await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } } })).json();
  assert.equal(init.result.serverInfo.name, "donecheck"); assert.equal(init.result.protocolVersion, "2025-06-18");
  assert.equal((await rpc({ jsonrpc: "2.0", method: "notifications/initialized" })).status, 202);
  const list = await (await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" })).json();
  assert.equal(list.result.tools[0].name, "done_check");
  const fix = await (await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "done_check", arguments: { task: T, result: "s.length > 12" } } })).json();
  assert.equal(fix.result.structuredContent.verdict, "FIX"); assert.match(fix.result.content[0].text, /^FIX:[\s\S]*receipt 0x(ef){32}[\s\S]*Do not say done/);
  const sub = await (await rpc({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "done_check", arguments: { task: T, result: "s.length >= 12" } } })).json();
  assert.equal(sub.result.structuredContent.verdict, "SUBMIT");
  const bad = await (await rpc({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "done_check", arguments: { task: "" } } })).json();
  assert.equal(bad.result.isError, true); assert.match(bad.result.content[0].text, /^Input error/);
  // the per-connection limit still applies through MCP: 5 per day (2 used above + 3 more), then HOLD with the reason
  for (let i = 0; i < 3; i++) await rpc({ jsonrpc: "2.0", id: 10 + i, method: "tools/call", params: { name: "done_check", arguments: { task: T, result: "s.length >= 12" } } });
  const capped = await (await rpc({ jsonrpc: "2.0", id: 20, method: "tools/call", params: { name: "done_check", arguments: { task: T, result: "s.length >= 12" } } })).json();
  assert.equal(capped.result.structuredContent.verdict, "HOLD"); assert.match(capped.result.content[0].text, /5 checks/);
  assert.equal((await (await rpc({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "nope" } })).json()).error.code, -32602);
  assert.equal((await (await rpc({ jsonrpc: "2.0", id: 7, method: "resources/list" })).json()).error.code, -32601);
  assert.equal((await rpc("{nope")).status, 400);
  assert.equal((await rpc([{ jsonrpc: "2.0", id: 8, method: "ping" }])).status, 400);
  const foreign = await rpc({ jsonrpc: "2.0", id: 9, method: "tools/list" }, { origin: "https://evil.example" });
  assert.equal(foreign.status, 403); assert.equal(foreign.headers.get("access-control-allow-origin"), null);
  assert.equal((await rpc(null, { method: "GET" })).status, 405);
  const st = await (await worker.fetch(new Request("https://donecheck.example/api/stats"), env, {})).json();
  assert.equal(st.clients["mcp-remote"], 5);
});
