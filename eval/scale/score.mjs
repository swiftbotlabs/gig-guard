// Scores the scale run. Truth = the dataset label (SmartBugs annotation = vulnerable; OpenZeppelin = audited), never a miner.
// A review is "right" when it flags a vulnerable contract or passes an audited one. Writes eval/scale/RESULTS.md + results.json.
//   GG_LEDGER=eval/scale/ledger.scale.jsonl node eval/scale/score.mjs
import fs from "node:fs";
import { readLedger } from "../../src/ledger.mjs";
import { flagsSecurity, flagsCode } from "../../src/report.mjs";
import { localFindings } from "../../src/guards.mjs";

const man = JSON.parse(fs.readFileSync(new URL("./manifest.json", import.meta.url), "utf8"));
const byName = new Map(man.items.map((x) => [x.name, x]));
const L = readLedger();
const all = L.filter((x) => x.kind === "decision" && x.gate === "ship" && byName.has(x.input?.name));
const last = new Map(); for (const d of all) last.set(d.input.name, d);   // latest decision per contract
const dec = [...last.values()];
const rerun = all.length - dec.length;
const z = () => ({ tp: 0, fn: 0, fp: 0, tn: 0, held: 0 });
const cell = (bug, flag) => (bug ? (flag ? "tp" : "fn") : flag ? "fp" : "tn");
const gate = z(), gateNoHint = z(), rules = z(), cats = {}, rows = new Map(), lat = [];
let spend = 0;
for (const d of dec) {
  const it = byName.get(d.input.name), bug = it.label === "vulnerable";
  const g = d.verdict === "HOLD" ? "held" : cell(bug, d.verdict === "FIX");
  gate[g]++; if (!it.hint) gateNoHint[g]++;
  (cats[it.category] ||= z())[g]++;
  const src = fs.readFileSync(new URL(`./samples/${it.name}`, import.meta.url), "utf8");
  rules[cell(bug, localFindings(src).length > 0)]++;
  for (const e of d.evidence || []) {
    if (!e.ok || !Number(e.cost_usd)) continue;
    const k = `${e.intent}|${e.miner_id ?? "?"}`;
    if (!rows.has(k)) rows.set(k, { intent: e.intent, miner: e.miner_id ?? "?", answers: 0, spend: 0, ...z(), empty: 0 });
    const r = rows.get(k); r.answers++; r.spend += Number(e.cost_usd);
    if (!e.result || !Object.keys(e.result).length) { r.empty++; continue; }
    r[cell(bug, e.intent === "SECURITY_REVIEW_GENERAL" ? flagsSecurity(e.result) : flagsCode(e.result))]++;
  }
}
// Spend and latency come from the purchase records, so an answer that was paid for but came back empty still counts.
for (const p of L.filter((x) => x.kind === "purchase")) { spend += Number(p.cost_usd || 0); if (Number.isFinite(p.ms)) lat.push(p.ms); }
const errs = {};
for (const x of L.filter((x) => x.kind === "error")) {
  const why = String(x.body?.reasoning || x.body?.error || "");
  const lim = /(\w+): is \d+ characters, over the (\d+) limit/.exec(why);
  const k = `${x.intent}: ${lim ? `input over the node's ${lim[2]}-character limit for \`${lim[1]}\` (no miner could take it; not charged)` : x.status ? `HTTP ${x.status} ${x.body?.error || ""}`.trim() : x.error || "error"}`;
  errs[k] = (errs[k] || 0) + 1;
}
const requests = L.filter((x) => x.kind === "purchase" || x.kind === "error").length;
const paid = L.filter((x) => x.kind === "purchase").length;
lat.sort((a, b) => a - b);
const q = (p) => (lat.length ? lat[Math.min(lat.length - 1, Math.ceil(p * lat.length) - 1)] : 0);
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "n/a");
const acc = (m) => pct(m.tp + m.tn, m.tp + m.tn + m.fp + m.fn);
const nv = man.items.filter((x) => x.label === "vulnerable").length, na = man.items.length - nv;
const byRows = [...rows.values()].map((r) => ({ ...r, spend: +r.spend.toFixed(4), right: r.tp + r.tn, usd_per_right: r.tp + r.tn ? +(r.spend / (r.tp + r.tn)).toFixed(4) : null }));
const gateRight = gate.tp + gate.tn;
const out = { decisions: dec.length, rerun, of: man.items.length, spend_usd: +spend.toFixed(4), requests, paid, failed: requests - paid,
  latency_ms: { p50: q(0.5), p95: q(0.95), n: lat.length }, gate, gate_without_name_hints: gateNoHint, local_rules_only: rules,
  usd_per_right_gate_decision: gateRight ? +(spend / gateRight).toFixed(4) : null, by_category: cats, by_intent_miner: byRows, failed_requests: errs };
const TAG = process.env.GG_SCALE_TAG ? `-${process.env.GG_SCALE_TAG.replace(/[^a-z0-9-]/gi, "")}` : "";
fs.writeFileSync(new URL(`./results${TAG}.json`, import.meta.url), JSON.stringify(out, null, 2) + "\n");
const tr = (label, m) => `| ${label} | ${m.tp} | ${m.fn} | ${m.fp} | ${m.tn} | ${m.held} | ${acc(m)} |`;
const md = [
  `# Scale run: ${dec.length} ship-gate decisions on public contracts with known labels`, "",
  `- ${nv} real contracts with annotated vulnerabilities from SmartBugs Curated (Apache-2.0) and ${na} audited OpenZeppelin v5.1.0 contracts (MIT). The list, sources, commits and hashes are in \`eval/scale/manifest.json\`; \`select.mjs\` rebuilds it.`,
  "- The dataset's own answer markers (header and `<yes> <report>` lines) were removed before review. Contract names were kept; " + `${man.items.filter((x) => x.hint).length} contracts have a name or comment that hints at the bug, so results are also shown without them.`,
  "- Truth is the dataset label. OpenZeppelin files are labelled \"audited\", not proven bug-free.", "",
  ...(rerun ? [`${rerun} contracts held in the first pass were run again after the gate learned to fit the review Intents' 2,000-character input limit (comments removed, code never cut); the tables use each contract's latest decision, and every earlier decision stays in the ledger.`, ""] : []),
  `Spend $${out.spend_usd.toFixed(2)} test USDC on Telegraph testnet. Requests ${requests}, answered and paid ${paid}, failed with no charge ${requests - paid}. Answer latency p50 ${(q(0.5) / 1000).toFixed(1)} s, p95 ${(q(0.95) / 1000).toFixed(1)} s.`, "",
  `**Cost per right gate decision: ${out.usd_per_right_gate_decision == null ? "n/a" : "$" + out.usd_per_right_gate_decision.toFixed(3)}** (all spend divided by decisions that matched the label).`, "",
  "| | Caught (vulnerable, flagged) | Missed | False alarm (audited, flagged) | Passed audited | Held: no review could be bought (availability, not accuracy) | Right, of decided |", "|---|---|---|---|---|---|---|",
  tr("Gate verdict", gate), tr("Gate verdict, contracts without name hints", gateNoHint), tr("Local rules alone (free)", { ...rules, held: 0 }), "",
  "| Category | Caught | Missed | Held |", "|---|---|---|---|",
  ...Object.entries(cats).filter(([c]) => c !== "audited").map(([c, m]) => `| ${c} | ${m.tp} | ${m.fn} | ${m.held} |`), "",
  "| Intent | Miner | Answers | Spend | Caught | Missed | False alarms | Passed audited | Empty | $ per right answer |", "|---|---|---|---|---|---|---|---|---|---|",
  ...byRows.map((r) => `| ${r.intent} | ${r.miner} | ${r.answers} | $${r.spend.toFixed(2)} | ${r.tp} | ${r.fn} | ${r.fp} | ${r.tn} | ${r.empty} | ${r.usd_per_right == null ? "n/a" : "$" + r.usd_per_right.toFixed(3)} |`), "",
  "Failed requests (not charged):", "", ...Object.entries(errs).map(([k, n]) => `- ${n} × ${k}`), "",
  "Every paid answer has its receipt in `eval/scale/ledger.public.jsonl`; `node src/cli.mjs verify` checks them against the testnet node.", "",
].join("\n");
fs.writeFileSync(new URL(`./RESULTS${TAG}.md`, import.meta.url), md);
console.log(JSON.stringify({ decisions: out.decisions, spend: out.spend_usd, gate, usd_per_right: out.usd_per_right_gate_decision }));
