// The deliver decision, pure (no I/O): shared by the CLI gate (src/guards.mjs) and the hosted done-check (hosted/worker.mjs).
const GOOD_RATING = new Set(["Excellent", "Good"]);

/** The deliver decision from the bought judgement, the optional CI check and the local checks. Pure. */
export function deliverVerdict(judge, ci, missing) {
  const reasons = [], uncertainty = [];
  let verdict = "SUBMIT";
  if (!judge.ok) { verdict = "HOLD"; reasons.push("no judgement could be bought: fail closed"); }
  else {
    const r = judge.result || {};
    const v = judge.intent === "TASK_EXECUTION_QUALITY_GENERAL" ? r.verdict : r.rating;
    const score = r.score === null || r.score === undefined ? "?" : Number(r.score).toFixed(1);
    const pass = judge.intent === "TASK_EXECUTION_QUALITY_GENERAL" ? v === "satisfies" : GOOD_RATING.has(v);
    const fail = judge.intent === "TASK_EXECUTION_QUALITY_GENERAL" ? v === "fails" : v === "Poor" || v === "Fails";
    if (fail) { verdict = "FIX"; reasons.push(`judge: ${v} (score ${score}). ${String(r.reason || (r.errors || []).join("; ") || "").slice(0, 200)}`); }
    else if (!pass) { verdict = "HOLD"; reasons.push(`judge: ${v ?? "no verdict"} (score ${score}): not a clear pass; a human decides`); }
    else reasons.push(`judge: ${v} (score ${score})`);
  }
  if (ci) {
    const c = ci.ok ? ci.result || {} : null;
    if (!ci.ok) { if (verdict === "SUBMIT") verdict = "HOLD"; reasons.push("CI result could not be bought: fail closed"); }
    else if (c.conclusion === "pending" || c.passed === null || c.passed === undefined) { if (verdict === "SUBMIT") verdict = "HOLD"; reasons.push(`CI: ${c.conclusion ?? "unknown"}: wait for a finished run`); }
    else if (c.passed === false || c.passed === "false" || c.conclusion === "failure") { verdict = "FIX"; reasons.push(`CI: ${c.conclusion} on ${c.commit || "the patch"}`); }
    else reasons.push(`CI: ${c.conclusion} on ${c.commit || "the patch"}`);
  }
  if (missing.length) {
    if (verdict === "SUBMIT") uncertainty.push("the judge passed it, but a required item is missing");
    verdict = "FIX";
    reasons.push(`missing from the result: ${missing.join(", ")}`);
  }
  return { verdict, reasons, uncertainty };
}
