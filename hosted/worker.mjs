// Hosted done-check: paste a task and a result, get SUBMIT / FIX / HOLD with a Telegraph receipt. No wallet needed by the visitor.
// Testnet only (Ethereum Sepolia escrow, Telegraph test USDC). The checks are paid from a SEPARATE throwaway testnet payer
// (DONECHECK_PAYER_KEY, a Worker secret holding only a small escrow deposit), never the main payer.
// Spend limits, all server side and fail closed:
//   - a global daily cap (DAY_CAP_UUSDC, default 200000 = $0.20) and a per-client daily cap (IP_MAX checks, default 5), kept in one
//     Durable Object; each check reserves its worst case (judge + fallback) before anything is signed, and settles to what was spent;
//   - every signed request counts, also one that fails (Telegraph issue #228);
//   - the escrow deposit itself is the last cap: when it is used up the node refuses, and the page says the day's budget is spent.
// Nothing the visitor pastes is stored. Their text is sent to Telegraph Miners for judging, so the page says not to paste secrets.
import { privateKeyToAccount } from "viem/accounts";
import { deliverVerdict } from "../src/verdict.mjs";
import { PAGE } from "./page.mjs";

const JUDGE = "TASK_EXECUTION_QUALITY_GENERAL", FALLBACK = "LLM_OUTPUT_EVALUATION_GENERAL";
const PRICE = 10000;            // μUSDC the judge is offered per request ($0.01)
const RESERVE = 2 * PRICE;      // worst case per check: judge + fallback
const LIMIT = 2000;             // characters of task + result (the judge Intents' limit)
const json = (o, status = 200, extra = {}) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra } });
const SEC = { "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "x-frame-options": "DENY",
  "content-security-policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self' https://devnode.telegraphprotocol.com; form-action 'none'; base-uri 'none'; frame-ancestors 'none'" };
const utcDay = () => new Date().toISOString().slice(0, 10);

/** Client key: IPv4 address, or the /64 of an IPv6 address, hashed with the day (no raw address is stored). */
export async function clientKey(ip, day = utcDay()) {
  let k = String(ip || "unknown");
  if (k.includes(":")) k = k.split(":").slice(0, 4).join(":") + "::/64";
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${day}|${k}`));
  return [...new Uint8Array(h)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Validates the visitor's input. Returns { task, result, mustInclude } or { error }. */
export function parseInput(body) {
  if (!body || typeof body !== "object") return { error: "send JSON: {\"task\": \"...\", \"result\": \"...\"}" };
  const task = typeof body.task === "string" ? body.task.trim() : "", result = typeof body.result === "string" ? body.result.trim() : "";
  if (!task || !result) return { error: "task and result are both required" };
  if (task.length + result.length > LIMIT) return { error: `task + result are ${task.length + result.length} characters; the judge takes at most ${LIMIT}` };
  const mi = body.mustInclude ?? [];
  if (!Array.isArray(mi) || mi.length > 5 || mi.some((x) => typeof x !== "string" || !x.trim() || x.length > 100)) return { error: "mustInclude: up to 5 non-empty strings of at most 100 characters" };
  return { task, result, mustInclude: mi.map((x) => x.trim()) };
}

/** One paid ask on the escrow rail. Returns { ok, intent, result, receipt, cost_usd, miner_id, ms, signed, error, fundsOut }. */
export async function askEscrow(node, account, intent, params, fetchImpl = fetch) {
  const url = `${node}/engine/v1/ask`, body = JSON.stringify({ intent, params, max_budget_usdc: PRICE });
  const t0 = Date.now();
  let signed = 0;
  try {
    const first = await fetchImpl(url, { method: "POST", headers: { "content-type": "application/json" }, body, signal: AbortSignal.timeout(20000) });
    let res = first;
    if (first.status === 402) {
      const h = first.headers.get("payment-required");
      const ch = h ? JSON.parse(atob(h)) : await first.json();
      const opt = (ch.accepts || []).find((a) => a.scheme === "escrow" && a.network === "eip155:11155111");
      if (!opt) return { ok: false, intent, error: "no escrow payment option offered" };
      const amount = (String(opt.extra?.message || "").match(/Amount:\s*(\d+)/) || [])[1] || opt.amount;
      if (!(Number(amount) > 0) || Number(amount) > PRICE) return { ok: false, intent, error: `quote ${amount} over the $0.01 price` };
      const now = Math.floor(Date.now() / 1000);
      const auth = { from: account.address.toLowerCase(), to: opt.payTo, value: String(amount), validAfter: String(now - 5), validBefore: String(now + 90),
        nonce: `dc-${now}-${crypto.getRandomValues(new Uint32Array(2)).join("")}` };
      const message = String(opt.extra.message).replace("{from}", auth.from).replace("{nonce}", auth.nonce).replace("{validAfter}", auth.validAfter).replace("{validBefore}", auth.validBefore);
      const signature = await account.signMessage({ message });
      const xp = btoa(JSON.stringify({ x402Version: 2, scheme: "escrow", network: opt.network, payload: { signature, authorization: auth } }));
      signed = Number(amount);
      res = await fetchImpl(url, { method: "POST", headers: { "content-type": "application/json", "X-PAYMENT": xp }, body, signal: AbortSignal.timeout(60000) });
    }
    const text = await res.text();
    let b; try { b = JSON.parse(text); } catch { b = {}; }
    if (res.status === 402 && /insufficient escrow/i.test(`${b.reason || ""}`)) return { ok: false, intent, error: "escrow used up", fundsOut: true, signed: 0 };
    const rh = res.headers.get("x-telegraph-receipt") || res.headers.get("x-payment-response");
    const receipt = rh ? JSON.parse(atob(rh)) : null;
    if (res.status !== 200 || !receipt) return { ok: false, intent, error: `HTTP ${res.status}`, signed };
    return { ok: true, intent, result: b.result || {}, receipt, cost_usd: b.cost_usd, miner_id: b.miner_id, ms: Date.now() - t0, signed: Number(receipt.amount_uusdc || signed) };
  } catch (e) { return { ok: false, intent, error: "no answer (timeout or network)", signed }; }
}

/** Budget keeper: one instance for the whole service. Storage: day, spent and reserved μUSDC, checks per client. */
export class Budget {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
  async state() {
    const day = utcDay();
    let s = await this.ctx.storage.get("s");
    if (!s || s.day !== day) s = { day, spent: 0, reserved: 0, clients: {} };
    return s;
  }
  /** Reserves the worst case for one check. Returns { ok, reason, left }. */
  async reserve(client) {
    const cap = Number(this.env.DAY_CAP_UUSDC || 200000), ipMax = Number(this.env.IP_MAX || 5);
    const s = await this.state();
    if ((s.clients[client] || 0) >= ipMax) return { ok: false, reason: `this connection has used its ${ipMax} checks for today (UTC)` };
    if (s.spent + s.reserved + RESERVE > cap) return { ok: false, reason: "today's testnet budget for the hosted check is used up; it resets at 00:00 UTC (or run it yourself, see the tutorial)" };
    s.clients[client] = (s.clients[client] || 0) + 1; s.reserved += RESERVE;
    await this.ctx.storage.put("s", s);
    return { ok: true, left: cap - s.spent - s.reserved };
  }
  /** Releases the reservation and books what was actually signed (failed signed requests included). */
  async settle(spentUusdc, exhausted = false) {
    const cap = Number(this.env.DAY_CAP_UUSDC || 200000);
    const s = await this.state();
    s.reserved = Math.max(0, s.reserved - RESERVE); s.spent += Math.max(0, Number(spentUusdc) || 0);
    if (exhausted) s.spent = Math.max(s.spent, cap);   // the escrow is empty: stop for the day
    await this.ctx.storage.put("s", s);
    return { left: Math.max(0, cap - s.spent - s.reserved) };
  }
  async left() { const cap = Number(this.env.DAY_CAP_UUSDC || 200000), s = await this.state(); return { left: Math.max(0, cap - s.spent - s.reserved), cap }; }
  // Classic Durable Object fetch interface (internal only: the binding is not reachable from the internet).
  async fetch(request) {
    const op = new URL(request.url).pathname.slice(1), a = request.method === "POST" ? await request.json() : {};
    if (op === "reserve") return Response.json(await this.reserve(String(a.client || "")));
    if (op === "settle") return Response.json(await this.settle(a.spent, !!a.exhausted));
    if (op === "left") return Response.json(await this.left());
    return new Response("not found", { status: 404 });
  }
}
async function bud(env, op, body) {
  const stub = env.BUDGET.get(env.BUDGET.idFromName("global"));
  const r = await stub.fetch(`https://budget/${op}`, body ? { method: "POST", body: JSON.stringify(body) } : {});
  if (!r.ok) throw new Error(`budget ${op} ${r.status}`);
  return r.json();
}

async function check(request, env, fetchImpl) {
  if (!/^application\/json\b/i.test(request.headers.get("content-type") || "")) return json({ error: "content-type must be application/json" }, 415);
  const raw = await request.text();
  if (raw.length > 8192) return json({ error: "request too large" }, 413);
  let body; try { body = JSON.parse(raw); } catch { return json({ error: "invalid JSON" }, 400); }
  const inp = parseInput(body);
  if (inp.error) return json({ error: inp.error }, 400);
  if (!/^0x[0-9a-fA-F]{64}$/.test(env.DONECHECK_PAYER_KEY || "")) return json({ error: "the hosted check is not configured" }, 503);
  let r; try { r = await bud(env, "reserve", { client: await clientKey(request.headers.get("cf-connecting-ip")) }); } catch { return json({ error: "budget keeper unavailable; nothing was spent" }, 503); }
  if (!r.ok) return json({ error: r.reason }, 429);
  const account = privateKeyToAccount(env.DONECHECK_PAYER_KEY);
  const node = env.TELEGRAPH_NODE || "https://devnode.telegraphprotocol.com";
  let spent = 0, out = null, exhausted = false;
  try {
    const tried = [];
    for (const [intent, params] of [[JUDGE, { task: inp.task, result: inp.result }], [FALLBACK, { task: inp.task, output: inp.result }]]) {
      const a = await askEscrow(node, account, intent, params, fetchImpl);
      spent += a.signed || 0;
      if (a.fundsOut) { exhausted = true; break; }
      if (a.ok) { out = a; break; }
      tried.push({ intent, error: a.error });
    }
    const missing = inp.mustInclude.filter((m) => !inp.result.includes(m));
    const judge = out ? { ok: true, intent: out.intent, result: out.result } : { ok: false };
    const v = deliverVerdict(judge, null, missing);
    if (exhausted) v.reasons.push("today's testnet budget is used up: no judgement could be bought (fail closed)");
    const left = (await bud(env, "settle", { spent, exhausted })).left;
    return json({ verdict: v.verdict, reasons: v.reasons, uncertainty: v.uncertainty, missing,
      receipt: out ? { receipt_hash: out.receipt.receipt_hash, epoch_id: out.receipt.epoch_id, intent: out.intent, amount_uusdc: Number(out.receipt.amount_uusdc || 0), miner_id: out.miner_id } : null,
      judge: out ? { intent: out.intent, verdict: out.result.verdict ?? out.result.rating ?? null, reason: String(out.result.reason || (out.result.errors || []).join("; ") || "").slice(0, 400) } : null,
      cost_usd: spent / 1e6, ms: out?.ms ?? null, budget_left_usd: left / 1e6, node, network: "Ethereum Sepolia escrow (testnet, test USDC)" });
  } catch {
    try { await bud(env, "settle", { spent }); } catch {}
    return json({ error: "the check failed; nothing beyond the signed requests was spent" }, 502);
  }
}

export default {
  async fetch(request, env, ctx, fetchImpl = fetch) {
    const u = new URL(request.url);
    if (u.pathname === "/" && (request.method === "GET" || request.method === "HEAD")) return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8", ...SEC } });
    if (u.pathname === "/api/budget" && request.method === "GET") {
      try { const b = await bud(env, "left"); return json({ left_usd: b.left / 1e6, cap_usd: b.cap / 1e6 }); } catch { return json({ error: "unavailable" }, 503); }
    }
    if (u.pathname === "/api/check" && request.method === "POST") {
      // Same-origin only: a browser on another site can't spend our budget through a visitor.
      const origin = request.headers.get("origin");
      if (origin && origin !== u.origin) return json({ error: "cross-origin requests are not accepted" }, 403);
      return check(request, env, fetchImpl);
    }
    return json({ error: "not found" }, 404);
  },
};
