// Optional second path into Telegraph: delegate a whole task to the Anjoman agent with an API key.
// The account's escrow balance pays the miner calls the agent makes (no per-call signature here).
// Used by the scout gate for a sponsor investigation when ANJOMAN_API_KEY is set; off otherwise.
//
//   ANJOMAN_API_KEY=anjoman_...     (testnet account; never commit it)
//   GG_DELEGATE_MAX_USD=0.05        hard cap per delegated task (sent as maxSpendUsd; also checked against the day cap)
//   ANJOMAN_URL                     default https://backend.telegraphprotocol.com
import { config } from "./config.mjs";
import { append, spentToday } from "./ledger.mjs";
import { BudgetError } from "./telegraph.mjs";

const BASE = () => (process.env.ANJOMAN_URL || "https://backend.telegraphprotocol.com").replace(/\/$/, "");
export const delegateEnabled = () => !!process.env.ANJOMAN_API_KEY;

/** Delegate one task. Returns {ok, status, answer, sources, cost_usd, job_id, receipts, ms}. Never throws on a bad answer. */
export async function delegate(message, { purpose = "", maxUsd = Number(process.env.GG_DELEGATE_MAX_USD || 0.05), pollMs = Number(process.env.GG_DELEGATE_POLL_MS || 3000), timeoutMs = config.timeoutMs } = {}) {
  const key = process.env.ANJOMAN_API_KEY;
  if (!key) throw new Error("ANJOMAN_API_KEY is not set");
  const capU = Math.round(maxUsd * 1e6);
  if (spentToday() + capU > config.maxPerDay) throw new BudgetError(`daily cap ${config.maxPerDay} uUSDC would be exceeded by a $${maxUsd} delegated task`);
  const h = { authorization: `Bearer ${key}`, "content-type": "application/json" };
  const t0 = Date.now();
  let r = await fetch(`${BASE()}/agent/chat`, { method: "POST", headers: h, body: JSON.stringify({ message, stream: false, maxSpendUsd: maxUsd }), signal: AbortSignal.timeout(timeoutMs) });
  let j = await r.json().catch(() => ({}));
  if (r.status === 401 || r.status === 403 || r.status === 400) throw new Error(`delegate: HTTP ${r.status} ${j.error || j.message || ""}`.trim());
  if (r.status === 429) throw new Error("delegate: rate limited (30 requests a minute per key)");
  while ((r.status === 202 || j.status === "running") && Date.now() - t0 < timeoutMs) { // long jobs: poll until done
    await new Promise((s) => setTimeout(s, pollMs));
    r = await fetch(`${BASE()}/agent/jobs/${j.jobId}`, { headers: h, signal: AbortSignal.timeout(30000) });
    j = await r.json().catch(() => ({ status: "running", jobId: j.jobId }));
  }
  const status = String(j.status || "unknown").toLowerCase();
  const cost = Number(j.costUsd ?? 0) || 0;
  // Any receipt hashes the agent reports for its paid steps (field names vary; 0x + 64 hex).
  const receipts = [...new Set((JSON.stringify(j).match(/0x[0-9a-f]{64}/gi) || []))];
  const out = { ok: status === "complete", status, answer: j.answer ?? null, sources: (j.sources || []).map((s) => (typeof s === "string" ? s : s?.url || s?.title || JSON.stringify(s))),
    cost_usd: cost, job_id: j.jobId || null, conversation_id: j.conversationId || null, receipts, ms: Date.now() - t0 };
  if (cost > maxUsd + 1e-9) out.over_cap = true; // should not happen: maxSpendUsd is enforced upstream; flagged if it does
  append({ kind: "purchase", intent: "ANJOMAN_AGENT_TASK", purpose, rail: "api-key", cost_usd: cost, amount_uusdc: Math.round(cost * 1e6),
    params: { task: message.slice(0, 300) }, result: { status, answer: out.answer, sources: out.sources },
    receipt: { job_id: out.job_id, conversation_id: out.conversation_id, step_receipts: receipts }, ms: out.ms });
  return out;
}
