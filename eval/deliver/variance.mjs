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
  const dec = new Map(), why = new Map(); for (const x of L) if (x.kind === "decision" && x.gate === "deliver") { dec.set(x.input?.name, x.verdict); why.set(x.input?.name, String((x.reasons || [])[0] || "")); }
  const ms = L.filter((x) => x.kind === "purchase").map((x) => x.ms).filter(Number.isFinite).sort((a, b) => a - b);
  const cost = L.filter((x) => x.kind === "purchase").reduce((s, x) => s + Number(x.cost_usd || 0), 0);
  const bad = cases.filter((c) => c.truth === "not_done"), good = cases.filter((c) => c.truth === "done");
  return { file: f.split("/").pop(), decided: cases.filter((c) => dec.has(c.id)).length,
    bad_submitted: bad.filter((c) => dec.get(c.id) === "SUBMIT").length, good_submitted: good.filter((c) => dec.get(c.id) === "SUBMIT").length,
    hold: cases.filter((c) => dec.get(c.id) === "HOLD").length,
    hold_supply: cases.filter((c) => dec.get(c.id) === "HOLD" && /no judgement could be bought/.test(why.get(c.id))).length, why, cost_usd: +cost.toFixed(2), p50_s: ms.length ? +(ms[Math.floor((ms.length - 1) / 2)] / 1000).toFixed(1) : null, dec };
});
const stat = (k) => { const v = runs.map((r) => r[k]); const m = v.reduce((a, b) => a + b, 0) / v.length; return `${+m.toFixed(1)} (range ${Math.min(...v)}-${Math.max(...v)})`; };
const all = cases.filter((c) => runs.every((r) => r.dec.has(c.id)));
const same = all.filter((c) => new Set(runs.map((r) => r.dec.get(c.id))).size === 1);
// A changed verdict is a supply effect when, in some run, no Miner answer could be bought for that case; otherwise the judge changed its mind.
const supplyCase = (c) => runs.some((r) => /no judgement could be bought/.test(r.why.get(c.id) || ""));
const changed = all.filter((c) => !same.includes(c));
const flipSupply = changed.filter(supplyCase).length, flipJudge = changed.length - flipSupply;
const flips = changed.map((c) => `- ${c.id} (${c.truth === "done" ? "correct result" : "planted defect"}): ${runs.map((r) => r.dec.get(c.id)).join(" / ")} (${supplyCase(c) ? "no Miner answer in a run" : "judge changed its verdict"})`);
const md = [`# Deliver gate: rerun variance (${runs.length} runs of the same 40 cases, Telegraph testnet)`, "",
  "| run | decided | defective submitted (of 20) | correct submitted (of 20) | HOLD (no Miner answer / unclear verdict) | cost (test USDC) | median answer s |", "|---|---|---|---|---|---|---|",
  ...runs.map((r) => `| ${r.file} | ${r.decided} | ${r.bad_submitted} | ${r.good_submitted} | ${r.hold} (${r.hold_supply} / ${r.hold - r.hold_supply}) | $${r.cost_usd.toFixed(2)} | ${r.p50_s} |`), "",
  `**The safety result held in every run: ${runs.every((r) => r.bad_submitted === 0) ? "no defective result was submitted in any of the " + runs.length + " runs" : "a defective result WAS submitted in some run"}.** The cost of failing closed is more HOLDs when Miner supply is thin. In the reruns, ${runs.slice(1).reduce((a, r) => a + r.hold_supply, 0)} of ${runs.slice(1).reduce((a, r) => a + r.hold, 0)} HOLDs were "no judgement could be bought": no Miner answer reached us (mostly "fetch failed" after the request was signed; we count those as possibly charged, issue #228; the cost column counts paid answers only), and nothing was claimed as done. Of the ${changed.length} cases whose verdict changed, ${flipSupply} changed because a Miner answer was missing in some run, and ${flipJudge} are real judge flips.`, "",
  `- Defective results submitted per run: ${stat("bad_submitted")}.`, `- Correct results submitted per run: ${stat("good_submitted")}.`, `- HOLD per run: ${stat("hold")}.`,
  `- Same verdict in every run: ${same.length} of ${all.length} cases.`, "", "Cases whose verdict changed between runs:", "", ...(flips.length ? flips : ["- none"]), ""].join("\n");
fs.writeFileSync(new URL("./VARIANCE.md", import.meta.url), md);
console.log(md);
