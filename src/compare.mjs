// "With vs without Telegraph", computed from the ledger, not staged.
// For every decision the agent made with paid Telegraph answers, replay what the same policy could decide
// with only the free checks it already has (local Solidity rules, a public-RPC balance read). Nothing is re-run
// and nothing is paid: the "without" side uses the free evidence recorded in the same decision.
import { readLedger } from "./ledger.mjs";
import { makeRedactor } from "./redact.mjs";
import { POLICY, scoutVerdict } from "./guards.mjs";

// Public output: client names, wallets and links are redacted, and the wording stays neutral (job, client, payment).
const words = (s) => String(s).replace(/\bPrizes?\b/g, "Payment").replace(/\bprizes?\b/g, "payment").replace(/\bSponsors?\b/g, "Client")
  .replace(/\bsponsors?\b/g, "client").replace(/\bBount(y|ies)\b/g, "Job").replace(/\bbount(y|ies)\b/g, "job").replace(/ paying winners/g, " paying").replace(/\bhackathon\b/gi, "");

const free = (d) => (d.evidence || []).filter((e) => /\(free\)$/.test(e.intent || ""));
const paid = (d) => (d.evidence || []).filter((e) => !/\(free\)$/.test(e.intent || ""));
const wasted = (d) => paid(d).flatMap((e) => (e.tried || []).filter((t) => t.cost_usd).map((t) => ({ intent: t.intent, why: t.error })));

/** What the policy could decide from free checks alone. Returns {verdict, why} or null if it can't be replayed. */
export function withoutTelegraph(d) {
  if (d.gate === "scout") return { verdict: "CAUTION", why: "no link reputation and no payment record: nothing to go on but the job post itself" };
  if (d.gate === "ship") {
    if (!Array.isArray(d.local_findings)) return null; // made by a policy version that didn't record local rules
    return d.local_findings.length
      ? { verdict: "FIX", why: `local rules only: ${d.local_findings.join("; ")}` }
      : { verdict: "SHIP", why: "local rules found nothing, and nobody else reviewed it" };
  }
  if (d.gate === "claim") {
    const c = free(d).find((e) => e.intent === "CHAIN_READ (free)");
    if (d.input?.txHash) return { verdict: "PENDING", why: "no way to look up the client's transaction without a paid lookup" };
    if (!c) return { verdict: "PENDING", why: "no free chain read for this chain/token: no proof either way" };
    const bal = Number(c.result?.balance);
    const covers = Number.isFinite(bal) && d.input?.prizeUsd && bal >= d.input.prizeUsd;
    return { verdict: covers ? "PAID" : "CLAIM", why: `one source only (public RPC): balance ${bal}` };
  }
  return null;
}

export function compare(entries = readLedger()) {
  const rows = [], R = makeRedactor(entries), n = { scout: 0, claim: 0 };
  const pub = (s) => words(R.text(s));
  for (const d of entries.filter((e) => e.kind === "decision" && e.gate)) {
    const w = withoutTelegraph(d);
    if (!w) continue;
    const p = paid(d);
    // Today's policy, replayed on the same recorded evidence (scout is the gate whose policy has changed since).
    let now = { verdict: d.verdict, why: (d.reasons || [])[0] || "" };
    if (d.gate === "scout" && d.input?.url && d.input?.sponsor && (d.evidence || []).length >= 2) { const v = scoutVerdict(d.input, d.evidence); now = { verdict: v.verdict, why: v.reasons[0] || "" }; }
    rows.push({
      ts: d.ts, gate: d.gate, policy: d.policy || "before v5", older_policy: (d.policy || "") !== POLICY,
      label: d.gate === "ship" ? pub(d.input?.name || "deliverable") : d.gate === "scout" ? `job lead ${++n.scout}` : `payment ${String.fromCharCode(64 + ++n.claim)}${d.action && /declined/.test(d.action) ? " (user says no)" : ""}`,
      without: { verdict: w.verdict, why: pub(w.why) }, with: { verdict: d.verdict, why: pub((d.reasons || [])[0] || "") },
      changed: w.verdict !== d.verdict,
      now: { verdict: now.verdict, why: pub(now.why) }, changed_now: w.verdict !== now.verdict, overturned: now.verdict !== d.verdict,
      paid_answers: p.filter((e) => e.ok && !e.reused).length,
      reused: p.filter((e) => e.reused).length,
      sources_with: p.filter((e) => e.ok).length + free(d).length, sources_without: free(d).length,
      cost_usd: Number(d.cost_usd || 0), ms: d.ms || 0,
      failures: [...wasted(d).map((x) => `${x.intent}: ${x.why}`), ...p.filter((e) => !e.ok).map((e) => `${e.intent}: ${e.error || "no answer"}`), ...(d.uncertainty || [])].map(pub),
      action: d.action ? pub(d.action) : null,
    });
  }
  const cost = rows.reduce((s, r) => s + r.cost_usd, 0);
  const changed = rows.filter((r) => r.changed).length, changedNow = rows.filter((r) => r.changed_now).length;
  return {
    method: "Each row is one real decision from the ledger. 'Without' replays the same policy on the free checks recorded in that decision; nothing is re-run.",
    totals: { decisions: rows.length, changed, same: rows.length - changed, cost_usd: +cost.toFixed(4),
      cost_per_changed_decision_usd: changed ? +(cost / changed).toFixed(4) : null,
      changed_now: changedNow, cost_per_changed_now_usd: changedNow ? +(cost / changedNow).toFixed(4) : null,
      overturned: rows.filter((r) => r.overturned).length, policy_now: POLICY,
      paid_answers: rows.reduce((s, r) => s + r.paid_answers, 0), failures: rows.reduce((s, r) => s + r.failures.length, 0) },
    rows,
  };
}

export function compareMarkdown(c) {
  const t = c.totals;
  return [
    "# Same decisions, with and without Telegraph", "", c.method, "",
    `${t.decisions} decisions. At the time, the paid answers changed ${t.changed} of them and confirmed ${t.same}. Spend $${t.cost_usd.toFixed(2)}${t.cost_per_changed_decision_usd !== null ? `, $${t.cost_per_changed_decision_usd.toFixed(3)} per changed decision` : ""}. Failures and doubts logged: ${t.failures}.`,
    `Replayed under today's policy (${t.policy_now}) on the same evidence: ${t.overturned} verdict(s) overturned, ${t.changed_now} of ${t.decisions} differ from the free-checks-only verdict${t.cost_per_changed_now_usd !== null ? ` ($${t.cost_per_changed_now_usd.toFixed(3)} per changed decision)` : ""}.`, "",
    "| Gate | Item | Without (free checks only) | With Telegraph, at the time | Today's policy, same evidence | Paid answers | Cost | Failures / doubts |",
    "|---|---|---|---|---|---|---|---|",
    ...c.rows.map((r) => `| ${r.gate} | ${r.label}${r.older_policy ? ` (policy ${r.policy})` : ""} | **${r.without.verdict}**: ${r.without.why} | **${r.with.verdict}**: ${r.with.why.slice(0, 120)} | ${r.overturned ? `**${r.now.verdict}**: ${r.now.why.slice(0, 120)}` : "same"} | ${r.paid_answers}${r.reused ? ` (+${r.reused} reused)` : ""} | $${r.cost_usd.toFixed(2)} | ${r.failures.join("; ").slice(0, 160) || "none"} |`),
  ].join("\n") + "\n";
}
