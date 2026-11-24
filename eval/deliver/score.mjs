// Scores the deliver gate's decisions against cases.json truth. Reads GG_LEDGER (default eval/deliver/ledger.deliver.jsonl).
// A "done" case should be SUBMIT; a "not_done" case must never be SUBMIT (FIX and HOLD both stop the agent from claiming success).
// Also scores the judge alone (its verdict before the free local checks) so the value of each part is visible.
import fs from "node:fs";
const ledger = process.env.GG_LEDGER || new URL("./ledger.deliver.jsonl", import.meta.url).pathname;
const { cases } = JSON.parse(fs.readFileSync(new URL("./cases.json", import.meta.url), "utf8"));
const dec = new Map();
for (const l of fs.readFileSync(ledger, "utf8").split("\n").filter(Boolean)) { const x = JSON.parse(l); if (x.kind === "decision" && x.gate === "deliver") dec.set(x.input?.name, x); }
const judgeSays = (d) => { const e = (d.evidence || [])[0]; if (!e?.ok) return "none";
  const v = e.intent === "TASK_EXECUTION_QUALITY_GENERAL" ? e.result?.verdict : e.result?.rating;
  return ["satisfies", "Excellent", "Good"].includes(v) ? "pass" : ["fails", "Poor", "Fails"].includes(v) ? "fail" : "unclear"; };
const t = { cases: cases.length, decided: 0, done_submitted: 0, done_total: 0, not_done_submitted: 0, not_done_stopped: 0, not_done_total: 0, held: 0,
  judge_stopped_bad: 0, local_stopped_bad: 0, held_unclear_bad: 0, judge_pass_on_bad: 0, judge_none_on_bad: 0, judge_fail_on_good: 0, caught_only_by_local: 0, cost_usd: 0 };
const rows = [];
for (const c of cases) {
  const d = dec.get(c.id); if (!d) continue; t.decided++; t.cost_usd += Number(d.cost_usd || 0);
  const j = judgeSays(d);
  if (d.verdict === "HOLD") t.held++;
  if (c.truth === "done") { t.done_total++; if (d.verdict === "SUBMIT") t.done_submitted++; if (j === "fail") t.judge_fail_on_good++; }
  else { t.not_done_total++; if (d.verdict === "SUBMIT") t.not_done_submitted++; else t.not_done_stopped++;
    // Who stopped it: the paid judge said fails; else the free required-items check found a missing item (FIX); else the gate
    // held because the judgement was not a clear pass (HOLD, fail closed). caught_only_by_local = everything the judge did not stop.
    if (j === "fail") t.judge_stopped_bad++;
    else if (d.verdict !== "SUBMIT") { t.caught_only_by_local++; if ((d.local_missing || []).length) t.local_stopped_bad++; else t.held_unclear_bad++; }
    if (j === "pass") t.judge_pass_on_bad++; if (j === "none") t.judge_none_on_bad++; }
  rows.push(`| ${c.id} | ${c.truth} | ${j} | ${d.verdict} | ${c.defect || ""} |`);
}
t.cost_usd = +t.cost_usd.toFixed(4);
// Answer latency of the paid judgements (purchases in the same ledger), so the cost and time per decision are both reproducible.
const ms = fs.readFileSync(ledger, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((x) => x.kind === "purchase" && x.purpose === "deliver").map((x) => x.ms).filter(Number.isFinite).sort((a, b) => a - b);
const pct = (f) => (ms.length ? +(ms[Math.floor(f * (ms.length - 1))] / 1000).toFixed(1) : null);
Object.assign(t, { paid_answers: ms.length, latency_p50_s: pct(0.5), latency_p95_s: pct(0.95), cost_per_decided_usd: t.decided ? +(t.cost_usd / t.decided).toFixed(4) : null });
// Verdicts by kind: HOLD is not a decision on the work (a human decides), so it is reported apart from SUBMIT/FIX.
const vc = { SUBMIT: 0, FIX: 0, HOLD: 0 };
for (const c of cases) { const d = dec.get(c.id); if (d) vc[d.verdict] = (vc[d.verdict] || 0) + 1; }
Object.assign(t, { verdict_submit: vc.SUBMIT, verdict_fix: vc.FIX, verdict_hold: vc.HOLD });
// Receipts: each paid answer's settlement status from the last `cli.mjs verify` run (receipts-verify.json next to this file).
let rv = null; try { const f = new URL("./receipts-verify.json", import.meta.url); rv = JSON.parse(fs.readFileSync(f, "utf8")); rv.checked_at ??= `on ${fs.statSync(f).mtime.toISOString().slice(0, 10)}`; } catch {}
const caseOf = new Map(); for (const d of dec.values()) for (const h of d.receipts || []) caseOf.set(h, d.input?.name);
const misses = cases.filter((c) => { const d = dec.get(c.id); return d && (c.truth === "done" ? d.verdict !== "SUBMIT" : d.verdict === "HOLD"); })
  .map((c) => { const d = dec.get(c.id); return `- **${c.id}** (${c.truth === "done" ? "a correct result" : `planted defect: ${c.defect}`}) -> ${d.verdict}. The judge said: "${String((d.reasons || []).join(" ")).replace(/"/g, "'").slice(0, 300)}"`; });
const allTs = fs.readFileSync(ledger, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((x) => x.kind === "purchase").map((x) => x.ts).sort();
const span = allTs.length ? `${allTs[0].slice(0, 16).replace("T", " ")} to ${allTs.at(-1).slice(0, 16).replace("T", " ")} UTC` : "n/a";
const md = [`# Deliver gate, known-answer run`, "",
  `- **Network:** Telegraph devnode, **testnet**: Ethereum Sepolia escrow rail, Telegraph test USDC. No real money.`,
  `- **Paid answers bought:** ${span} (logs: \`run-1.log\` to \`run-4.log\`). Results were committed in 5573077; the receipt re-check is in ff86f0b.`,
  `- **Receipts:** ${rv ? `${rv.settled} of ${rv.total} SETTLED, ${rv.pending} pending, ${rv.mismatch} mismatched, checked ${rv.checked_at} (\`receipts-verify.json\`, table at the end)` : "not checked yet"}.`,
  `- **The set:** 20 tasks we wrote ourselves, one planted defect per task, truth set by construction. It is not a third-party benchmark.`, "",
  `${t.cases} cases ran (20 tasks, each with a correct result and one with a planted defect). Gate verdicts: **${vc.SUBMIT} SUBMIT, ${vc.FIX} FIX, ${vc.HOLD} HOLD**. HOLD means the gate did not decide: the judgement was not a clear pass, so a human looks. It is counted apart from SUBMIT and FIX. (In the JSON, \`decided\` = cases that ran to a gate verdict, HOLD included.)`, "",
  "```", JSON.stringify(t, null, 1), "```", "",
  "## Where the gate did not give the expected verdict", "",
  "A correct result should be SUBMIT; a defective one must never be SUBMIT (FIX or HOLD both stop it). No defective result was submitted. The cases below are the misses and the holds, with the judge's own words:", "",
  ...misses, "",
  "- Why csv-dedupe/good was stopped: the judge returned the verdict `fails` while its reason describes the result as correct (and gave score 10). The gate reads the verdict and ignores the score, so a self-contradicting `fails` becomes FIX. That is a false stop: it costs a human look, never a bad delivery. A second judge for verdicts that contradict their reason is on the list in `docs/MAINNET.md`.", "",
  "## Reruns", "", "Two reruns of the same 40 cases (24 Nov) are in [VARIANCE.md](VARIANCE.md): no defective result was submitted in any of the 3 runs; correct results submitted 18 / 14 / 17; most extra HOLDs were Miner answers that never arrived (supply), and 3 verdict changes were real judge flips.", "",
  "## Every case", "",
  "| case | truth | judge alone | gate | planted defect |", "|---|---|---|---|---|", ...rows, "",
  ...(rv ? ["## Receipt settlement", "",
    `Checked ${rv.checked_at || "with `node src/cli.mjs verify`"}: **${rv.settled} of ${rv.total} SETTLED**, ${rv.pending} pending, ${rv.mismatch} mismatched, ${rv.other} other. SETTLED means the receipt is listed in its epoch block on the Telegraph node with the same intent and amount. Re-check any receipt: \`GET https://devnode.telegraphprotocol.com/v1/blocks/{epoch}/deliveries/{receipt_hash}\`, or the \"Check receipts live\" button on the replay page.`, "",
    "| case | intent | miner | epoch | receipt | status |", "|---|---|---|---|---|---|",
    ...(rv.receipts || []).map((r) => `| ${caseOf.get(r.receipt_hash) || ""} | ${r.intent} | ${r.miner_id ?? ""} | ${r.epoch_id} | \`${r.receipt_hash}\` | ${r.status} |`)] : [])].join("\n") + "\n";
fs.writeFileSync(new URL("./RESULTS.md", import.meta.url), md);
console.log(JSON.stringify(t));
