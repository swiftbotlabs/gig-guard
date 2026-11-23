// Minimal Telegraph client: one paid ask over x402 with hard spending limits.
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "./config.mjs";
import { append, spentToday } from "./ledger.mjs";

let paidFetch, payer;
function client() {
  if (paidFetch) return paidFetch;
  const key = process.env.TELEGRAPH_PAYER_KEY;
  if (!key) throw new Error("TELEGRAPH_PAYER_KEY is not set (use a testnet-only key)");
  const account = privateKeyToAccount(key);
  payer = account.address;
  paidFetch = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: config.network, client: new ExactEvmScheme(account) }],
    spendControls: {
      allowedAssets: [{ network: config.network, asset: config.assets[config.network], maxAmountPerPayment: String(config.maxPerCall) }],
    },
  });
  return paidFetch;
}

export class BudgetError extends Error { name = "BudgetError"; }

// The node reserves each request's max_budget_usdc against the prepaid escrow balance until the next epoch block bills it.
// When reservations reach the balance it answers 402 "insufficient escrow for delivery: unbilled=U μUSDC + price=P μUSDC > balance=B μUSDC".
// That is not "no miner": every later request fails the same way. It is thrown as EscrowFundsError, so a gate records no
// decision (no false HOLD) and a run stops at once with the shortfall, instead of walking through the remaining cases.
export class EscrowFundsError extends Error {
  name = "EscrowFundsError";
  constructor(message, info) { super(message); this.info = info; }
}
/** Parses the node's insufficient-escrow reason. Returns { unbilled, price, balance, shortfall } in μUSDC, or null. */
export function parseEscrowShortfall(reason) {
  const m = String(reason || "").match(/unbilled=(\d+)\D+?price=(\d+)\D+?balance=(\d+)/);
  if (!m) return null;
  const [unbilled, price, balance] = m.slice(1).map(Number);
  return { unbilled, price, balance, shortfall: Math.max(0, unbilled + price - balance) };
}

// Escrow rail (Ethereum Sepolia): prepaid balance on the Telegraph Diamond, one EIP-191 signature
// per request, no facilitator in the path. Enabled with GG_RAIL=escrow.
let escrowAccount;
function escrowFetch(maxPerCall) {
  if (!escrowAccount) {
    const key = process.env.TELEGRAPH_PAYER_KEY;
    if (!key) throw new Error("TELEGRAPH_PAYER_KEY is not set (use a testnet-only key)");
    escrowAccount = privateKeyToAccount(key);
    payer = escrowAccount.address;
  }
  return async (url, init) => {
    const first = await fetch(url, init);
    if (first.status !== 402) return first;
    const h = first.headers.get("payment-required");
    const ch = h ? JSON.parse(Buffer.from(h, "base64").toString("utf8")) : await first.json();
    const opt = (ch.accepts || []).find((a) => a.scheme === "escrow" && a.network === "eip155:11155111");
    if (!opt) throw new Error("node offered no escrow option");
    const amount = (opt.extra.message.match(/Amount:\s*(\d+)/) || [])[1] || opt.amount;
    if (Number(amount) > maxPerCall) throw new BudgetError(`escrow quote ${amount} exceeds per-call cap ${maxPerCall}`);
    const now = Math.floor(Date.now() / 1000);
    const authorization = { from: escrowAccount.address.toLowerCase(), to: opt.payTo, value: String(amount),
      validAfter: String(now - 5), validBefore: String(now + 90), nonce: `gg-${now}-${Math.random().toString(36).slice(2, 10)}` };
    const message = opt.extra.message.replace("{from}", authorization.from).replace("{nonce}", authorization.nonce)
      .replace("{validAfter}", authorization.validAfter).replace("{validBefore}", authorization.validBefore);
    const signature = await escrowAccount.signMessage({ message });
    const xp = Buffer.from(JSON.stringify({ x402Version: 2, scheme: "escrow", network: opt.network, payload: { signature, authorization } })).toString("base64");
    const res = await fetch(url, { ...init, headers: { ...init.headers, "X-PAYMENT": xp } });
    return res;
  };
}

/** Buy one answer for `intent`. Returns { result, receipt, cost_usd, miner_id, ms }. Throws on failure. */
export async function ask(intent, params, { budget = config.maxPerCall, purpose = "" } = {}) {
  if (budget > config.maxPerCall) throw new BudgetError(`budget ${budget} exceeds per-call cap ${config.maxPerCall}`);
  if (spentToday() + budget > config.maxPerDay) throw new BudgetError(`daily cap ${config.maxPerDay} uUSDC reached`);
  const f = config.rail === "escrow" ? escrowFetch(config.maxPerCall) : client();
  const t0 = Date.now();
  const ctrl = AbortSignal.timeout(config.timeoutMs);
  let res;
  try {
    res = await f(`${config.node}/engine/v1/ask`, {
      method: "POST", signal: ctrl,
      headers: { "Content-Type": "application/json" },
      // A multi-miner budget needs a refundable rail (Sepolia escrow/diamond); on Base Sepolia the node
      // rejects it, so there we buy a single routed answer at the base price.
      body: JSON.stringify(config.rail === "escrow" || config.network === "eip155:11155111" ? { intent, params, max_budget_usdc: budget } : { intent, params }),
    });
  } catch (e) {
    append({ kind: "error", intent, params, purpose, error: String(e.message || e) });
    throw e;
  }
  const ms = Date.now() - t0;
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 500) }; }
  const rh = res.headers.get("x-telegraph-receipt") || res.headers.get("x-payment-response");
  const receipt = rh ? JSON.parse(Buffer.from(rh, "base64").toString("utf8")) : null;
  if (res.status === 402 && /insufficient escrow/i.test(`${body.reason || ""} ${body.error || ""}`)) {
    const info = parseEscrowShortfall(body.reason);
    append({ kind: "error", intent, params, purpose, status: 402, escrow: info, ms });
    throw new EscrowFundsError(`escrow balance exhausted: ${body.reason || body.error}`, info);
  }
  if (res.status !== 200 || !receipt) {
    append({ kind: "error", intent, params, purpose, status: res.status, body, ms });
    throw new Error(`Telegraph ${intent} failed: HTTP ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
  }
  append({ kind: "purchase", intent, params, purpose, payer, network: config.rail === "escrow" ? "eip155:11155111" : config.network, rail: config.rail, miner_id: body.miner_id,
    cost_usd: body.cost_usd, amount_uusdc: Number(receipt.amount_uusdc || 0), receipt, result: body.result,
    field_status: body.field_status, ms });
  return { result: body.result || {}, receipt, cost_usd: body.cost_usd, miner_id: body.miner_id, field_status: body.field_status, ms };
}
