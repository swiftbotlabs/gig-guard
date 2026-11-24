// Scores a planted-bug run against eval/truth.json. The truth is the planted label, not the miner and not our local rules.
// A review is correct when it flags a buggy sample or passes a clean one. Writes eval/RESULTS.md and eval/results.json.
//   GG_LEDGER=eval/ledger.eval.jsonl node eval/score.mjs
import fs from "node:fs";
import { readLedger } from "../src/ledger.mjs";
import { flagsSecurity, flagsCode } from "../src/report.mjs";
import { localFindings, shipVerdict } from "../src/guards.mjs";

const truth = JSON.parse(fs.readFileSync(new URL("./truth.json", import.meta.url), "utf8"));
const L = readLedger();
const buys = L.filter((x) => x.kind === "purchase");
const decisions = L.filter((x) => x.kind === "decision" && x.gate === "ship" && truth[x.input?.name]);
const rows = new Map(), lat = [], per = [];
const row = (intent, miner) => {
  const k = `${intent}|${miner ?? "?"}`;
  if (!rows.has(k)) rows.set(k, { intent, miner: miner ?? "?", answers: 0, spend: 0, tp: 0, fn: 0, fp: 0, tn: 0, empty: 0 });
  return rows.get(k);
};
const cell = (bug, flag) => (bug ? (flag ? "tp" : "fn") : flag ? "fp" : "tn");
const gate = { tp: 0, fn: 0, fp: 0, tn: 0, held: 0 }, rules = { tp: 0, fn: 0, fp: 0, tn: 0 };
// The verdict the current code gives on the same stored answers (no new purchase). Differs from the recorded verdict
// only where the parser changed.
const redo = { tp: 0, fn: 0, fp: 0, tn: 0, held: 0 };
let spend = 0;
for (const d of decisions) {
  const bug = truth[d.input.name].bug;
  if (d.verdict === "HOLD") gate.held++; else gate[cell(bug, d.verdict === "FIX")]++;
  const src = fs.readFileSync(new URL(`./samples/${d.input.name}`, import.meta.url), "utf8");
  rules[cell(bug, localFindings(src).length > 0)]++;
  const [sr, cr] = d.evidence || [];
  const now = shipVerdict(sr || { ok: false }, cr || { ok: false, intent: "CODE_REVIEW_GENERAL" }, localFindings(src)).verdict;
  if (now === "HOLD") redo.held++; else redo[cell(bug, now === "FIX")]++;
  const line = { sample: d.input.name, bug, gate: d.verdict, gate_now: now, answers: [] };
  for (const e of d.evidence || []) {
    if (!e.ok || !Number(e.cost_usd)) continue;
    const r = row(e.intent, e.miner_id); r.answers++; r.spend += Number(e.cost_usd); spend += Number(e.cost_usd);
    const p = buys.find((b) => b.intent === e.intent && d.receipts?.includes(b.receipt?.receipt_hash));
    if (Number.isFinite(p?.ms)) lat.push(p.ms);
    if (!e.result) { r.empty++; line.answers.push(`${e.intent} miner ${e.miner_id}: empty`); continue; }
    const flag = e.intent === "SECURITY_REVIEW_GENERAL" ? flagsSecurity(e.result) : flagsCode(e.result);
    const c = cell(bug, flag); r[c]++;
    line.answers.push(`${e.intent} miner ${e.miner_id}: ${flag ? "flagged" : "passed"} (${c.toUpperCase()})`);
  }
  per.push(line);
}
lat.sort((a, b) => a - b);
const q = (p) => (lat.length ? lat[Math.min(lat.length - 1, Math.ceil(p * lat.length) - 1)] : 0);
const acc = (m) => (m.tp + m.tn) / Math.max(1, m.tp + m.tn + m.fp + m.fn);
const errs = {};
for (const x of L.filter((x) => x.kind === "error")) {
  const k = `${x.intent}: ${x.status ? `HTTP ${x.status} ${x.body?.error || ""}`.trim() : x.error || "error"}`;
  errs[k] = (errs[k] || 0) + 1;
}
const requests = L.filter((x) => x.kind === "purchase" || x.kind === "error").length;
const pct = (x) => `${Math.round(x * 100)}%`;
const byRows = [...rows.values()].map((r) => ({ ...r, spend: +r.spend.toFixed(4), correct: r.tp + r.tn,
  cost_per_correct_usd: r.tp + r.tn ? +(r.spend / (r.tp + r.tn)).toFixed(4) : null }));
const out = { samples: decisions.length, spend_usd: +spend.toFixed(4), latency_ms: { p50: q(0.5), p95: q(0.95), n: lat.length },
  gate, gate_current_code: redo, local_rules_only: rules, requests, failed_requests: errs, by_intent_miner: byRows, per_sample: per };
fs.writeFileSync(new URL("./results.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
const md = [
  `# Planted-bug run: ${decisions.length} Solidity samples, ground truth known`, "",
  "8 samples with one planted bug each (SWC-104/105/106/107/112/115/120/121) and 4 written clean (`eval/truth.json`). Each went through the ship gate once on Telegraph testnet: one SECURITY_REVIEW_GENERAL and one CODE_REVIEW_GENERAL answer, bought by the agent. A review is correct when it flags a buggy sample or passes a clean one. The truth is the planted label, not a miner and not our local rules.", "",
  `Spend $${out.spend_usd.toFixed(2)} test USDC. Answer latency p50 ${(out.latency_ms.p50 / 1000).toFixed(1)} s, p95 ${(out.latency_ms.p95 / 1000).toFixed(1)} s (${out.latency_ms.n} answers).`, "",
  `Requests sent: ${requests}; answered and paid: ${lat.length}; failed with no charge: ${requests - lat.length}.`, "",
  ...Object.entries(errs).map(([k, n]) => `- ${n} × ${k}`), "",
  "| | Caught (of 8 bugs) | Missed | False alarms (of 4 clean) | Held: no review could be bought | Correct, of decided |", "|---|---|---|---|---|---|",
  `| Gate verdict as recorded on 2026-11-20 (FIX = flagged) | ${gate.tp} | ${gate.fn} | ${gate.fp} | ${gate.held} | ${pct(acc(gate))} |`,
  `| Same answers, re-decided by the current code (fixed parser, no new purchase) | ${redo.tp} | ${redo.fn} | ${redo.fp} | ${redo.held} | ${pct(acc(redo))} |`,
  `| Local rules alone (free) | ${rules.tp} | ${rules.fn} | ${rules.fp} | 0 | ${pct(acc(rules))} |`, "",
  "| Intent | Miner | Answers | Spend | Caught | Missed | False alarms | Passed clean | Empty | $ per correct answer |",
  "|---|---|---|---|---|---|---|---|---|---|",
  ...byRows.map((r) => `| ${r.intent} | ${r.miner} | ${r.answers} | $${r.spend.toFixed(2)} | ${r.tp} | ${r.fn} | ${r.fp} | ${r.tn} | ${r.empty} | ${r.cost_per_correct_usd == null ? "n/a" : "$" + r.cost_per_correct_usd.toFixed(3)} |`), "",
  "Per sample:", "", ...per.map((l) => `- ${l.sample} (${l.bug ? "bug" : "clean"}): gate ${l.gate}${l.gate_now !== l.gate ? ` (current code: ${l.gate_now})` : ""}; ${l.answers.join("; ")}`), "",
  "Limits: 12 short samples written by us, one pass each, so a rerun can differ. Every answer's receipt is in `eval/ledger.public.jsonl`.",
  "The review parser was fixed (2026-11-21) after reading these 11 answers: three code reviews that named the bug (B02 \"not secure\", B05 \"unchecked low-level call\", B07 \"not correct ... can permanently lose funds\") had been read as passes, and one security review that said \"no security vulnerabilities were found\" had been read as a flag because it listed advisory IDs. The re-decided row is therefore in-sample; a fresh run with the frozen parser is the out-of-sample check.", "",
  "B07_MissingAccessControl.sol also shipped with NO security answer: SECURITY_REVIEW_GENERAL failed (HTTP 500, context deadline exceeded) and the gate shipped on the code review alone. An outside replay pointed this out (Iniwura/falsum#97). Since policy v7 (24 Nov), a contract never ships without a security answer; the best outcome without one is HOLD (test: 'ship: no security answer is never SHIP'). On the stored answers, the current code gives B07 FIX, because the fixed parser reads its code review as a flag.", "",
].join("\n");
fs.writeFileSync(new URL("./RESULTS.md", import.meta.url), md);
console.log(JSON.stringify({ samples: out.samples, spend: out.spend_usd, gate, local_rules_only: rules, latency_ms: out.latency_ms }));
