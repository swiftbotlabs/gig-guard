// Scores the held-out set (eval/deliver/heldout/cases.json, hash in HELDOUT.sha256) from its own ledger; writes heldout/RESULTS.md.
//   GG_LEDGER=eval/deliver/heldout/ledger.jsonl node eval/deliver/heldout/score.mjs
import fs from "node:fs";
import crypto from "node:crypto";
const here = (f) => new URL(`./${f}`, import.meta.url);
const raw = fs.readFileSync(here("cases.json"));
const sha = crypto.createHash("sha256").update(raw).digest("hex"), frozen = fs.readFileSync(here("HELDOUT.sha256"), "utf8").split(/\s+/)[0];
if (sha !== frozen) { console.error(`cases.json changed after freezing (sha256 ${sha} != ${frozen})`); process.exit(1); }
const { cases } = JSON.parse(raw);
const L = fs.readFileSync(process.env.GG_LEDGER || here("ledger.jsonl").pathname, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const dec = new Map(); for (const x of L) if (x.kind === "decision" && x.gate === "deliver") dec.set(x.input?.name, x);
let rv = null; try { rv = JSON.parse(fs.readFileSync(here("receipts-verify.json"), "utf8")); } catch {}
const bad = cases.filter((c) => c.truth === "not_done"), good = cases.filter((c) => c.truth === "done");
const v = (c) => dec.get(c.id)?.verdict;
const t = { cases: cases.length, ran: cases.filter((c) => dec.has(c.id)).length, bad_submitted: bad.filter((c) => v(c) === "SUBMIT").length, bad_total: bad.length,
  good_submitted: good.filter((c) => v(c) === "SUBMIT").length, good_total: good.length, hold: cases.filter((c) => v(c) === "HOLD").length,
  hold_no_answer: cases.filter((c) => v(c) === "HOLD" && /no judgement could be bought/.test(String(dec.get(c.id)?.reasons?.[0]))).length,
  cost_usd: +L.filter((x) => x.kind === "purchase").reduce((s, x) => s + Number(x.cost_usd || 0), 0).toFixed(2) };
const rows = cases.map((c) => `| ${c.id} | ${c.truth} | ${v(c) || "not run"} | ${c.defect || ""} | ${String(dec.get(c.id)?.reasons?.[0] || "").replace(/\|/g, "/").slice(0, 120)} |`);
const md = [`# Held-out set: one live run (Telegraph testnet)`, "",
  `- 10 new tasks (a correct and a defective result each), written after the gate changes and never used for tuning. Frozen before the run: sha256 \`${frozen}\` (HELDOUT.sha256, committed first).`,
  `- Network: testnet (Ethereum Sepolia escrow, test USDC). Receipts: ${rv ? `${rv.settled} of ${rv.total} SETTLED, ${rv.pending} pending, ${rv.mismatch} mismatched` : "not checked yet"}.`, "",
  "```", JSON.stringify(t, null, 1), "```", "", "| case | truth | gate | planted defect | first reason |", "|---|---|---|---|---|", ...rows, ""].join("\n");
fs.writeFileSync(here("RESULTS.md"), md); console.log(JSON.stringify(t));
