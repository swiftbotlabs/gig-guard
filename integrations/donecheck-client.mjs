// Drop-in client for the hosted done-check (testnet; no wallet, no key). Ask before your agent says "done":
//   import { doneCheck } from "./integrations/donecheck-client.mjs";
//   const v = await doneCheck({ task, result, mustInclude: ["total"] });   // -> { verdict: "SUBMIT"|"FIX"|"HOLD", reasons, receipt, ... }
//   if (v.verdict !== "SUBMIT") { /* fix it, or ask a human */ }
// CLI: node integrations/donecheck-client.mjs "<task>" "<result>" [mustInclude,comma,separated]   (exit 0 only on SUBMIT)
// The hosted check is shared and capped (5 checks per connection per day). For your own volume, run the gate yourself with your own
// testnet escrow (docs/TUTORIAL-done-check.md); `deliverCheck` in src/guards.mjs is the same decision.
export const DONECHECK_URL = process.env.DONECHECK_URL || "https://donecheck.swiftbotlab.workers.dev";

/** Calls the hosted done-check. Never throws on a refusal: returns { verdict: "HOLD", error } so callers fail closed. */
export async function doneCheck({ task, result, mustInclude = [] }, { url = DONECHECK_URL, timeoutMs = 90000, fetchImpl = fetch } = {}) {
  if (typeof task !== "string" || typeof result !== "string" || !task.trim() || !result.trim()) throw new Error("task and result must be non-empty strings");
  let r;
  try {
    r = await fetchImpl(`${url}/api/check`, { method: "POST", headers: { "content-type": "application/json", "x-donecheck-client": "donecheck-js/0.1.0" },
      body: JSON.stringify({ task, result, mustInclude }), signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) { return { verdict: "HOLD", error: `done-check unreachable: ${e.message || e}`, reasons: ["no check could be made: fail closed"] }; }
  let body; try { body = await r.json(); } catch { body = {}; }
  if (!r.ok || !["SUBMIT", "FIX", "HOLD"].includes(body.verdict)) {
    return { verdict: "HOLD", error: body.error || `HTTP ${r.status}`, reasons: ["no check could be made: fail closed"] };
  }
  return body;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [task, result, must] = process.argv.slice(2);
  if (!task || !result) { console.error('usage: node integrations/donecheck-client.mjs "<task>" "<result>" [must,include]'); process.exit(2); }
  const v = await doneCheck({ task, result, mustInclude: must ? must.split(",").map((x) => x.trim()).filter(Boolean) : [] });
  console.log(JSON.stringify(v, null, 2));
  process.exit(v.verdict === "SUBMIT" ? 0 : 10);
}
