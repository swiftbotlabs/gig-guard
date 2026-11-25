// Report for the live second-opinion run: per case, the original verdict (run 1, ledger.deliver.jsonl) vs the panel verdict, and the votes.
//   node eval/deliver/second-judge-report.mjs eval/deliver/second-judge.jsonl   (writes eval/deliver/SECOND-JUDGE.md)
import fs from "node:fs";
const here = (f) => new URL(`./${f}`, import.meta.url);
const { cases } = JSON.parse(fs.readFileSync(here("cases.json"), "utf8"));
const read = (f) => { const d = new Map(); for (const l of fs.readFileSync(f, "utf8").split("\n").filter(Boolean)) { const x = JSON.parse(l); if (x.kind === "decision" && x.gate === "deliver") d.set(x.input?.name, x); } return d; };
const orig = read(here("ledger.deliver.jsonl").pathname), now = read(process.argv[2] || here("second-judge.jsonl").pathname);
const L = fs.readFileSync(process.argv[2] || here("second-judge.jsonl").pathname, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const cost = L.filter((x) => x.kind === "purchase").reduce((s, x) => s + Number(x.cost_usd || 0), 0);
const rows = cases.filter((c) => now.has(c.id)).map((c) => { const d = now.get(c.id); const panel = (d.reasons || []).find((r) => /judge panel/.test(r)) || "no panel (first judge passed or no answer)";
  const want = c.truth === "done" ? "SUBMIT" : "FIX or HOLD"; const ok = c.truth === "done" ? d.verdict === "SUBMIT" : d.verdict !== "SUBMIT";
  return `| ${c.id} | ${c.truth} | ${orig.get(c.id)?.verdict ?? "-"} | ${d.verdict} | ${want} | ${ok ? "yes" : "NO"} | ${panel.replace(/\|/g, "/")} |`; });
const md = ["# Second opinion: live run on the hardest cases (Telegraph testnet)", "",
  "The gate with `GG_SECOND_JUDGE=1` works like this. When the first judge says \"fails\" or is unclear, and the free check passed, it asks other Miners by id and decides by majority; with no majority it holds. Below, each case's first-run verdict sits next to the verdict with the second opinion.", "",
  "| case | truth | first run | with second opinion | expected | right | panel |", "|---|---|---|---|---|---|---|", ...rows, "", `Spend: $${cost.toFixed(2)} test USDC.`, ""].join("\n");
fs.writeFileSync(here("SECOND-JUDGE.md"), md); console.log(md);
