#!/usr/bin/env node
// gig-guard: the three gates as shell commands, plus `heartbeat` for an agent loop.
import fs from "node:fs";
import { scoutBounty, claimPayout, shipCheck } from "./guards.mjs";
import { writeLedgerPage } from "./page.mjs";
import { publicLedger } from "./redact.mjs";
import { readLedger } from "./ledger.mjs";
import { verifyLedger } from "./verify.mjs";
import { costReport, reportMarkdown } from "./report.mjs";
const [cmd, ...a] = process.argv.slice(2);
const usage = `gig-guard scout <url> <sponsor> [prizeUsd]          Mission 09: triage a bounty
gig-guard claim <json>                                 Mission 15: overdue prize -> proof + claim draft
     json: {"wallet","chain","token","txHash?","sponsor","prizeUsd","termsFile?","dueDate?","contact?","label?","approved?"}
     approved: true|false|absent. A CLAIM is never sent by Gig Guard; without approved:true it waits for the user.
gig-guard ship <file>                                  Mission 14: review a deliverable before submitting
gig-guard heartbeat <queue.json> [out.json]            run every pending item in a queue (agent loop)
gig-guard ledger [out.html] [verify.json]              render the public ledger page (redacted)
gig-guard report [out.md] [out.json]                   Mission 10: cost per verified correct answer, by Intent and miner
gig-guard export [out.jsonl]                           redacted copy of the ledger, safe to publish
gig-guard verify [out.json]                            check every receipt against the node's settled epoch blocks
  Public output replaces sponsor names (or a queue item's "label"), prize wallets, tx hashes and links.
  ledger.jsonl itself is PRIVATE: never publish it.`;
const GO = ["GO", "PAID", "SHIP"];
async function runItem(it) {
  if (it.gate === "scout") return scoutBounty(it);
  if (it.gate === "claim") return claimPayout({ ...it, termsText: it.termsFile ? fs.readFileSync(it.termsFile, "utf8") : it.termsText });
  if (it.gate === "ship") return shipCheck(fs.readFileSync(it.file, "utf8"), { name: it.file.split("/").pop() });
  throw new Error(`unknown gate ${it.gate}`);
}
try {
  let d;
  if (cmd === "scout") d = await scoutBounty({ url: a[0], sponsor: a[1], prizeUsd: Number(a[2]) || undefined });
  else if (cmd === "claim") d = await runItem({ gate: "claim", ...JSON.parse(a[0]) });
  else if (cmd === "ship") d = await runItem({ gate: "ship", file: a[0] });
  else if (cmd === "heartbeat") {
    const q = JSON.parse(fs.readFileSync(a[0], "utf8"));
    const out = [];
    for (const it of q.filter((x) => !x.done)) {
      const t0 = Date.now();
      console.error(`[${new Date().toISOString().slice(11, 19)}] ${it.id}: ${it.gate} gate, buying intelligence from Telegraph...`);
      try { const r = await runItem(it);
        console.error(`[${new Date().toISOString().slice(11, 19)}] ${it.id}: ${r.verdict}  ($${Number(r.cost_usd || 0).toFixed(2)}, ${r.receipts.length} receipt${r.receipts.length === 1 ? "" : "s"}, ${((Date.now() - t0) / 1000).toFixed(1)} s)${r.action && r.action !== "none" ? "  next: " + r.action : ""}`);
        for (const x of r.reasons) console.error(`           - ${x.slice(0, 150)}`);
        for (const x of r.uncertainty || []) console.error(`           ? ${x.slice(0, 150)}`);
        out.push({ id: it.id, gate: it.gate, verdict: r.verdict, action: r.action, uncertainty: r.uncertainty, reasons: r.reasons, receipts: r.receipts, cost_usd: r.cost_usd, claim: r.claim }); it.done = new Date().toISOString(); it.verdict = r.verdict; }
      catch (e) { console.error(`[${new Date().toISOString().slice(11, 19)}] ${it.id}: refused before paying: ${e.message}`); out.push({ id: it.id, gate: it.gate, error: e.message }); if (e.name === "BudgetError") break; }
    }
    fs.writeFileSync(a[0], JSON.stringify(q, null, 2));
    if (a[1]) fs.writeFileSync(a[1], JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2)); process.exit(0);
  }
  else if (cmd === "export") { const out = a[0] || "ledger.public.jsonl"; fs.writeFileSync(out, publicLedger(readLedger()).map((e) => JSON.stringify(e)).join("\n") + "\n"); console.log(out); process.exit(0); }
  else if (cmd === "verify") { const v = await verifyLedger(); if (a[0]) fs.writeFileSync(a[0], JSON.stringify(v, null, 2)); const { receipts, ...sum } = v; console.log(JSON.stringify(sum)); process.exit(v.mismatch ? 10 : 0); }
  else if (cmd === "report") { const r = costReport(); if (a[0]) fs.writeFileSync(a[0], reportMarkdown(r)); if (a[1]) fs.writeFileSync(a[1], JSON.stringify(r, null, 2)); console.log(JSON.stringify({ totals: r.totals, by_intent_miner: r.by_intent_miner }, null, 2)); process.exit(0); }
  else if (cmd === "ledger") { console.log(writeLedgerPage(a[0], { verifyFile: a[1] })); process.exit(0); }
  else { console.log(usage); process.exit(cmd ? 2 : 0); }
  console.log(JSON.stringify({ verdict: d.verdict, action: d.action, uncertainty: d.uncertainty, reasons: d.reasons, receipts: d.receipts, cost_usd: d.cost_usd, ms: d.ms, claim: d.claim }, null, 2));
  process.exit(GO.includes(d.verdict) ? 0 : 10);
} catch (e) { console.error("gig-guard:", e.message); process.exit(1); }
