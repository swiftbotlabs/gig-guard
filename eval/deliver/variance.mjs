// Rerun variance of the deliver gate: reads the original run plus reruns (one private ledger each), scores each the same way as
// score.mjs, and writes eval/deliver/VARIANCE.md: per-run headline numbers, mean and range, and per-case agreement (how many cases got
// the same verdict in every run). Read-only: it buys nothing.
//   node eval/deliver/variance.mjs eval/deliver/ledger.deliver.jsonl eval/deliver/rerun-1.jsonl eval/deliver/rerun-2.jsonl eval/deliver/rerun-3.jsonl
import fs from "node:fs";
const { cases } = JSON.parse(fs.readFileSync(new URL("./cases.json", import.meta.url), "utf8"));
const files = process.argv.slice(2);
if (files.length < 2) { console.error("usage: variance.mjs <ledger> <ledger> [...]"); process.exit(2); }
const runs = files.map((f) => {
  const L = fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const dec = new Map(); for (const x of L) if (x.kind === "decision" && x.gate === "deliver") dec.set(x.input?.name, x.verdict);
  const ms = L.filter((x) => x.kind === "purchase").map((x) => x.ms).filter(Number.isFinite).sort((a, b) => a - b);
  const cost = L.filter((x) => x.kind === "purchase").reduce((s, x) => s + Number(x.cost_usd || 0), 0);
  const bad = cases.filter((c) => c.truth === "not_done"), good = cases.filter((c) => c.truth === "done");
  return { file: f.split("/").pop(), decided: cases.filter((c) => dec.has(c.id)).length,
    bad_submitted: bad.filter((c) => dec.get(c.id) === "SUBMIT").length, good_submitted: good.filter((c) => dec.get(c.id) === "SUBMIT").length,
    hold: cases.filter((c) => dec.get(c.id) === "HOLD").length, cost_usd: +cost.toFixed(2), p50_s: ms.length ? +(ms[Math.floor((ms.length - 1) / 2)] / 1000).toFixed(1) : null, dec };
});
const stat = (k) => { const v = runs.map((r) => r[k]); const m = v.reduce((a, b) => a + b, 0) / v.length; return `${+m.toFixed(1)} (range ${Math.min(...v)}-${Math.max(...v)})`; };
const all = cases.filter((c) => runs.every((r) => r.dec.has(c.id)));
const same = all.filter((c) => new Set(runs.map((r) => r.dec.get(c.id))).size === 1);
const flips = all.filter((c) => !same.includes(c)).map((c) => `- ${c.id} (${c.truth === "done" ? "correct result" : "planted defect"}): ${runs.map((r) => r.dec.get(c.id)).join(" / ")}`);
const md = [`# Deliver gate: rerun variance (${runs.length} runs of the same 40 cases, Telegraph testnet)`, "",
  "| run | decided | defective submitted (of 20) | correct submitted (of 20) | HOLD | cost (test USDC) | median answer s |", "|---|---|---|---|---|---|---|",
  ...runs.map((r) => `| ${r.file} | ${r.decided} | ${r.bad_submitted} | ${r.good_submitted} | ${r.hold} | $${r.cost_usd.toFixed(2)} | ${r.p50_s} |`), "",
  `- Defective results submitted per run: ${stat("bad_submitted")}.`, `- Correct results submitted per run: ${stat("good_submitted")}.`, `- HOLD per run: ${stat("hold")}.`,
  `- Same verdict in every run: ${same.length} of ${all.length} cases.`, "", "Cases whose verdict changed between runs:", "", ...(flips.length ? flips : ["- none"]), ""].join("\n");
fs.writeFileSync(new URL("./VARIANCE.md", import.meta.url), md);
console.log(md);
