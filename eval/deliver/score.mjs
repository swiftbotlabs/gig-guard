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
  judge_pass_on_bad: 0, judge_fail_on_good: 0, caught_only_by_local: 0, cost_usd: 0 };
const rows = [];
for (const c of cases) {
  const d = dec.get(c.id); if (!d) continue; t.decided++; t.cost_usd += Number(d.cost_usd || 0);
  const j = judgeSays(d);
  if (d.verdict === "HOLD") t.held++;
  if (c.truth === "done") { t.done_total++; if (d.verdict === "SUBMIT") t.done_submitted++; if (j === "fail") t.judge_fail_on_good++; }
  else { t.not_done_total++; if (d.verdict === "SUBMIT") t.not_done_submitted++; else t.not_done_stopped++;
    if (j === "pass") { t.judge_pass_on_bad++; if (d.verdict !== "SUBMIT") t.caught_only_by_local++; } }
  rows.push(`| ${c.id} | ${c.truth} | ${j} | ${d.verdict} | ${c.defect || ""} |`);
}
t.cost_usd = +t.cost_usd.toFixed(4);
const md = [`# Deliver gate, known-answer run`, "", "```", JSON.stringify(t, null, 1), "```", "",
  "| case | truth | judge alone | gate | planted defect |", "|---|---|---|---|---|", ...rows].join("\n") + "\n";
fs.writeFileSync(new URL("./RESULTS.md", import.meta.url), md);
console.log(JSON.stringify(t));
