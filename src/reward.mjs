// Simulated reward logic for responsible vulnerability triage (Mission 14, Route 3). No money moves: it decides what a bug-bounty
// program WOULD pay for a report, from the contract gate's paid evidence. Policy, fixed and fail closed:
//   - a reward is auto-approved only when the gate says FIX AND a deterministic local rule confirms a finding (SWC id). A finding only a
//     Miner reported goes to a human for reproduction: $0 until reproduced. SHIP closes the report ($0); HOLD goes to a human ($0).
//   - severity comes from the confirmed SWC id (table below), never from a Miner's own rating; one reward per (contract, SWC id):
//     a second report of the same finding is a duplicate ($0); the program pool caps the total.
export const SEVERITY = { "SWC-106": "high", "SWC-112": "high", "SWC-115": "high", "SWC-104": "medium", "SWC-120": "medium" };
export const PAYOUT = { high: 500, medium: 200 };   // simulated USD

export function rewardFor(decision, state = { paid: new Set(), pool: 5000 }) {
  const name = decision?.input?.name || "unknown";
  if (decision?.gate !== "ship") return { name, status: "not a contract review", usd: 0 };
  if (decision.verdict === "SHIP") return { name, status: "closed: no vulnerability", usd: 0 };
  if (decision.verdict === "HOLD") return { name, status: "human review: evidence unclear", usd: 0 };
  if (decision.verdict !== "FIX") return { name, status: "human review: unknown verdict", usd: 0 };
  const swcs = [...new Set((decision.local_findings || []).map((f) => /SWC-\d+/.exec(f)?.[0]).filter((s) => s && SEVERITY[s]))];
  if (!swcs.length) return { name, status: "pending reproduction: Miner-only finding", usd: 0 };
  const fresh = swcs.filter((s) => !state.paid.has(`${name}|${s}`));
  if (!fresh.length) return { name, status: "duplicate", usd: 0, swc: swcs };
  const sev = fresh.map((s) => SEVERITY[s]).includes("high") ? "high" : "medium";
  const want = PAYOUT[sev];
  if (state.pool < want) return { name, status: "pool exhausted: human decides", usd: 0, swc: fresh, severity: sev };
  for (const s of fresh) state.paid.add(`${name}|${s}`);
  state.pool -= want;
  return { name, status: "auto-approved (rule-confirmed)", usd: want, swc: fresh, severity: sev, receipts: decision.receipts || [] };
}
