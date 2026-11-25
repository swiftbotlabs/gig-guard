// Scores the outsider blind set over one or more runs (each run its own ledger); checks the frozen hash first; writes RESULTS.md.
//   node eval/deliver/outsider/score.mjs eval/deliver/outsider/run-1.jsonl eval/deliver/outsider/run-2.jsonl eval/deliver/outsider/run-3.jsonl
import fs from "node:fs";
import crypto from "node:crypto";
const here = (f) => new URL(`./${f}`, import.meta.url);
const raw = fs.readFileSync(here("cases.json"));
const sha = crypto.createHash("sha256").update(raw).digest("hex"), frozen = fs.readFileSync(here("OUTSIDER.sha256"), "utf8").split(/\s+/)[0];
if (sha !== frozen) { console.error(`cases.json changed after freezing (sha256 ${sha} != ${frozen})`); process.exit(1); }
const { cases } = JSON.parse(raw);
const files = process.argv.slice(2); if (!files.length) { console.error("usage: node score.mjs <run ledger>..."); process.exit(2); }
const good = cases.filter((c) => c.truth === "done"), bad = cases.filter((c) => c.truth === "not_done");
const runs = files.map((f) => {
  const L = fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const dec = new Map(); for (const x of L) if (x.kind === "decision" && x.gate === "deliver") dec.set(x.input?.name, x);
  const v = (c) => dec.get(c.id)?.verdict;
  const pairs = good.map((g) => [g, bad.find((b) => b.id === g.id.replace(/\/good$/, "/bad"))]);
  const cost = L.filter((x) => x.kind === "purchase").reduce((s, x) => s + Number(x.cost_usd || 0), 0);
  return { file: f, ran: cases.filter((c) => dec.has(c.id)).length, bad_submitted: bad.filter((c) => v(c) === "SUBMIT").length,
    good_submitted: good.filter((c) => v(c) === "SUBMIT").length, hold: cases.filter((c) => v(c) === "HOLD").length,
    hold_no_answer: cases.filter((c) => v(c) === "HOLD" && /no judgement could be bought/.test(String(dec.get(c.id)?.reasons?.[0]))).length,
    pairs_right: pairs.filter(([g, b]) => v(g) === "SUBMIT" && v(b) !== "SUBMIT").length, cost_usd: +cost.toFixed(3),
    decided: cases.filter((c) => v(c) === "SUBMIT" || v(c) === "FIX").length, verdicts: Object.fromEntries(cases.map((c) => [c.id, v(c) || "not run"])) };
});
const stat = (k) => { const xs = runs.map((r) => r[k]); return { mean: +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1), min: Math.min(...xs), max: Math.max(...xs) }; };
const sum = { runs: runs.length, cases: cases.length, bad_total: bad.length, good_total: good.length,
  false_submit: stat("bad_submitted"), good_submitted: stat("good_submitted"), hold: stat("hold"), hold_no_answer: stat("hold_no_answer"), pairs_right: stat("pairs_right"),
  cost_per_decision_usd: +(runs.reduce((s, r) => s + r.cost_usd, 0) / Math.max(1, runs.reduce((s, r) => s + r.decided, 0))).toFixed(4) };
const rows = cases.map((c) => `| ${c.id} | ${c.source} | ${c.truth} | ${runs.map((r) => r.verdicts[c.id]).join(" / ")} |`);
const md = ["# Outsider blind set (LLMBar): live runs on Telegraph testnet", "",
  "- 10 LLMBar items (5 Natural, 5 Adversarial) = 20 cases. Tasks, outputs and labels were written by the LLMBar authors (Princeton NLP, MIT licence), not by us; the items were picked by a fixed rule in `build.mjs`, not by hand.",
  `- Frozen before any run: sha256 \`${frozen}\` (OUTSIDER.sha256, committed first). The gate code was not changed between runs.`,
  "- Scoring: the human-preferred output should get SUBMIT; the other should not. LLMBar labels are pairwise preferences, so a 'not_done' output may be partly acceptable: a SUBMIT on it is counted as a false SUBMIT anyway.", "",
  "```", JSON.stringify(sum, null, 1), "```", "", `| case | source | truth | ${runs.map((_, i) => `run ${i + 1}`).join(" / ")} |`, "|---|---|---|---|", ...rows, "",
  "Per run:", "", "```", ...runs.map((r) => JSON.stringify({ ...r, verdicts: undefined })), "```", ""].join("\n");
fs.writeFileSync(here("RESULTS.md"), md); console.log(JSON.stringify(sum));
