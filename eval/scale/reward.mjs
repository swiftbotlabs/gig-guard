// Runs the simulated reward logic (src/reward.mjs) over the contract gate's latest decision per contract, and scores it against the
// dataset labels (SmartBugs = vulnerable, OpenZeppelin = audited). Writes eval/scale/REWARDS.md + rewards.json. No new spend.
//   GG_LEDGER=eval/scale/ledger.scale.jsonl node eval/scale/reward.mjs
import fs from "node:fs";
import { readLedger } from "../../src/ledger.mjs";
import { rewardFor, SEVERITY, PAYOUT } from "../../src/reward.mjs";
const man = JSON.parse(fs.readFileSync(new URL("./manifest.json", import.meta.url), "utf8"));
const label = new Map(man.items.map((x) => [x.name, x.label]));
const last = new Map(); for (const d of readLedger()) if (d.kind === "decision" && d.gate === "ship" && label.has(d.input?.name)) last.set(d.input.name, d);
// Contract names that embed a deployed address are shortened the way the public ledger shows them (0x01f8…1d3f); receipt hashes stay.
const shortName = (n) => n.replace(/0x([0-9a-fA-F]{4})[0-9a-fA-F]{32}([0-9a-fA-F]{4})/g, "0x$1…$2");
const state = { paid: new Set(), pool: 10000 }, rows = [...last.values()].map((d) => { const r = rewardFor(d, state); return { ...r, name: shortName(r.name), label: label.get(d.input.name) }; });
const t = { reports: rows.length, auto_approved: 0, auto_on_vulnerable: 0, wrongful_payouts: 0, pending_reproduction: 0, human: 0, closed: 0, closed_on_vulnerable: 0, usd_paid: 0, pool_left: 0, by_status: {} };
for (const r of rows) {
  t.by_status[r.status] = (t.by_status[r.status] || 0) + 1; t.usd_paid += r.usd;
  if (r.usd > 0) { t.auto_approved++; if (r.label === "vulnerable") t.auto_on_vulnerable++; else t.wrongful_payouts++; }
  if (r.status.startsWith("pending")) t.pending_reproduction++;
  if (r.status.startsWith("human")) t.human++;
  if (r.status.startsWith("closed")) { t.closed++; if (r.label === "vulnerable") t.closed_on_vulnerable++; }
}
t.pool_left = state.pool;
fs.writeFileSync(new URL("./rewards.json", import.meta.url), JSON.stringify({ policy: { SEVERITY, PAYOUT, pool: 10000 }, totals: t, rows }, null, 1) + "\n");
const md = ["# Simulated reward logic on the 129-contract run (Mission 14, Route 3)", "",
  "No money moves. Each contract review is treated as a bug report to a test bounty program. The program pays (in simulation) only when the gate says FIX **and** a deterministic local rule confirms the finding; Miner-only findings wait for human reproduction; SHIP closes, HOLD goes to a human. Severity comes from the confirmed SWC id, never from a Miner's own rating. One reward per (contract, SWC id); a $10,000 pool caps the total. Policy: `src/reward.mjs`; tests: `test/reward.test.mjs`.", "",
  "Scored against the dataset labels (SmartBugs = vulnerable, OpenZeppelin = audited), using the same latest decision per contract as RESULTS.md. Rewards cite the paid receipts the decision was based on (rewards.json).", "",
  "```", JSON.stringify(t, null, 1), "```", "",
  "| contract | label | status | severity | simulated USD |", "|---|---|---|---|---|",
  ...rows.filter((r) => r.usd > 0 || r.status !== "pending reproduction: Miner-only finding").map((r) => `| ${r.name} | ${r.label} | ${r.status} | ${r.severity || ""} | ${r.usd} |`), "",
  `${t.pending_reproduction} more reports are "pending reproduction: Miner-only finding" (in rewards.json).`, ""].join("\n");
fs.writeFileSync(new URL("./REWARDS.md", import.meta.url), md); console.log(JSON.stringify(t));
