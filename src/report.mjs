// Mission 10 (Model Economy): cost per verified correct answer, per Intent and miner, from Gig Guard's own ledger.
//
// Every paid answer gets exactly one grade. The grade comes from a check that does not trust the miner:
//   correct    an independent check agrees (free chain read for balances; local rules for code reviews)
//   incorrect  an independent check contradicts it (balance differs from the chain; a review passes code
//              where a local rule fires)
//   empty      paid, but the needed fields came back empty or stale (partial / unanswerable)
//   unconfirmed the miner raised a finding that no local rule backs: not proven right, not proven wrong
//   unknown    no independent check exists for this Intent yet (link scans, web search)
// Reused answers cost $0 and are not graded again. "Unknown" is kept apart from "incorrect" on purpose.
import { readLedger } from "./ledger.mjs";

const TOL = (x) => Math.max(0.01, Math.abs(x) * 0.01);
const lc = (s) => String(s ?? "").toLowerCase();
const flagsSecurity = (r) => /insecure|needs changes/.test(lc(r?.verdict)) || (!r?.verdict && Number(r?.vulnerability_count || r?.issues?.length || 0) > 0);
const flagsCode = (r) => /request changes/.test(lc(r?.verdict)) || /not correct or safe|reentran|critical|vulnerab|tx\.origin|delegatecall|selfdestruct/.test(lc(JSON.stringify(r?.findings || [])));

/** Grade one paid answer inside a decision. Returns {grade, why}. */
export function grade(d, e) {
  if (e.intent === "WALLET_BALANCE_CHECK_GENERAL") {
    const chain = (d.evidence || []).find((x) => x.intent === "CHAIN_READ (free)");
    const b = e.result?.balance;
    if (b === null || b === undefined || b === "") return { grade: "empty", why: "no balance in the answer" };
    if (!chain || !Number.isFinite(Number(chain.result?.balance))) return { grade: "unknown", why: "no free chain read for this chain/token" };
    const c = Number(chain.result.balance);
    return Math.abs(Number(b) - c) <= TOL(c)
      ? { grade: "correct", why: `matches the chain (${c})` }
      : { grade: "incorrect", why: `said ${b}, chain says ${c}` };
  }
  if (e.intent === "SECURITY_REVIEW_GENERAL" || e.intent === "CODE_REVIEW_GENERAL") {
    if (!d.input?.solidity || !Array.isArray(d.local_findings)) return { grade: "unknown", why: "no local rules for this code" };
    const miner = e.intent === "SECURITY_REVIEW_GENERAL" ? flagsSecurity(e.result) : flagsCode(e.result);
    const local = d.local_findings.length > 0;
    if (miner && local) return { grade: "correct", why: `flagged, and local rules agree: ${d.local_findings[0]}` };
    if (!miner && !local) return { grade: "correct", why: "passed, and no local rule fires" };
    if (!miner && local) return { grade: "incorrect", why: `passed code where a local rule fires: ${d.local_findings[0]}` };
    return { grade: "unconfirmed", why: "flagged, but no local rule backs it" };
  }
  return { grade: "unknown", why: "no independent check for this Intent yet" };
}

/** Build the report from ledger entries (defaults to the configured ledger). */
export function costReport(entries = readLedger()) {
  const rows = new Map(), answers = [];
  const row = (intent, miner) => {
    const k = `${intent}|${miner ?? "?"}`;
    if (!rows.has(k)) rows.set(k, { intent, miner: miner ?? "?", paid: 0, spend_usd: 0, correct: 0, incorrect: 0, empty: 0, unconfirmed: 0, unknown: 0 });
    return rows.get(k);
  };
  for (const d of entries.filter((x) => x.kind === "decision")) {
    for (const e of d.evidence || []) {
      for (const t of e.tried || []) { // paid but unusable answers from suppliers that were skipped
        if (!t.cost_usd) continue;
        const r = row(t.intent, t.miner_id); r.paid++; r.spend_usd += Number(t.cost_usd); r.empty++;
        answers.push({ gate: d.gate, intent: t.intent, miner: t.miner_id ?? "?", grade: "empty", why: t.error, cost_usd: Number(t.cost_usd) });
      }
      if (!e.ok || e.reused || !Number(e.cost_usd)) continue; // free reads and reuse are not paid answers
      const g = grade(d, e);
      const r = row(e.intent, e.miner_id); r.paid++; r.spend_usd += Number(e.cost_usd); r[g.grade]++;
      answers.push({ gate: d.gate, intent: e.intent, miner: e.miner_id ?? "?", ...g, cost_usd: Number(e.cost_usd) });
    }
  }
  const per = (r) => ({ ...r, spend_usd: +r.spend_usd.toFixed(4),
    checked: r.correct + r.incorrect + r.empty,
    cost_per_verified_correct_usd: r.correct ? +(r.spend_usd / r.correct).toFixed(4) : null,
    accuracy_when_checked: r.correct + r.incorrect + r.empty ? +(r.correct / (r.correct + r.incorrect + r.empty)).toFixed(3) : null });
  const by = [...rows.values()].map(per).sort((a, b) => (a.cost_per_verified_correct_usd ?? 1e9) - (b.cost_per_verified_correct_usd ?? 1e9) || b.paid - a.paid);
  const tot = by.reduce((s, r) => { for (const k of ["paid", "spend_usd", "correct", "incorrect", "empty", "unconfirmed", "unknown"]) s[k] += r[k]; return s; },
    { paid: 0, spend_usd: 0, correct: 0, incorrect: 0, empty: 0, unconfirmed: 0, unknown: 0 });
  const checkable = answers.filter((a) => ["correct", "incorrect", "empty"].includes(a.grade)).reduce((s, a) => s + a.cost_usd, 0);
  return {
    method: "Each paid answer is graded by a check that does not trust the miner: a free public-RPC read for balances, deterministic local rules for Solidity reviews. Answers with no such check are 'unknown', never counted as correct.",
    totals: { ...tot, spend_usd: +tot.spend_usd.toFixed(4),
      cost_per_verified_correct_usd: tot.correct ? +(tot.spend_usd / tot.correct).toFixed(4) : null,
      checkable_spend_usd: +checkable.toFixed(4),
      cost_per_verified_correct_checkable_usd: tot.correct ? +(checkable / tot.correct).toFixed(4) : null },
    by_intent_miner: by, answers,
  };
}

/** Markdown version for the README / submission. */
export function reportMarkdown(rep) {
  const $ = (x) => (x === null ? "n/a" : `$${x.toFixed(3)}`);
  const t = rep.totals;
  const lines = [
    "# Cost per verified correct answer",
    "",
    rep.method,
    "",
    `Paid answers: ${t.paid} ($${t.spend_usd.toFixed(2)}). Correct ${t.correct}, incorrect ${t.incorrect}, empty ${t.empty}, unconfirmed ${t.unconfirmed}, unknown ${t.unknown}.`,
    `Cost per verified correct answer: ${$(t.cost_per_verified_correct_usd)} over all spend, ${$(t.cost_per_verified_correct_checkable_usd)} over checkable spend only.`,
    "",
    "| Intent | Miner | Paid | Spend | Correct | Incorrect | Empty | Unconfirmed | Unknown | $ per verified correct |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...rep.by_intent_miner.map((r) => `| ${r.intent} | ${r.miner} | ${r.paid} | $${r.spend_usd.toFixed(2)} | ${r.correct} | ${r.incorrect} | ${r.empty} | ${r.unconfirmed} | ${r.unknown} | ${$(r.cost_per_verified_correct_usd)} |`),
    "",
    "Wrong and empty answers, with the reason:",
    "",
    ...rep.answers.filter((a) => a.grade === "incorrect" || a.grade === "empty").map((a) => `- ${a.intent} (miner ${a.miner}, ${a.gate} gate): ${a.grade}, ${a.why}`),
  ];
  if (!rep.answers.some((a) => a.grade === "incorrect" || a.grade === "empty")) lines.push("- none in this ledger");
  return lines.join("\n") + "\n";
}
