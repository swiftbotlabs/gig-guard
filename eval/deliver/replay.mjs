// One-click judge replay of the deliver-gate run: a static page, no key, no server. For each of the 40 known-answer cases it shows
// the task, the output, the truth, the free required-items check, the paid judgement and the gate's verdict, and every paid answer's
// Telegraph receipt with a "Check receipts live" button that asks the node, from the viewer's browser, whether it is settled.
//   node eval/deliver/replay.mjs [out.html]      (reads cases.json, ledger.public.jsonl, receipts-verify.json, RESULTS.md)
import fs from "node:fs";
const here = (f) => new URL(`./${f}`, import.meta.url);
const out = process.argv[2] || here("replay.html").pathname;
const { cases } = JSON.parse(fs.readFileSync(here("cases.json"), "utf8"));
const L = fs.readFileSync(here("ledger.public.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const ver = {}; try { for (const r of JSON.parse(fs.readFileSync(here("receipts-verify.json"), "utf8")).receipts) ver[r.receipt_hash] = r.status; } catch {}
const S = JSON.parse(fs.readFileSync(here("RESULTS.md"), "utf8").match(/```\n(\{[\s\S]*?\})\n```/)[1]);
// Rerun variance (eval/deliver/VARIANCE.md), shown as mean and range, never just the best run.
let VAR = "";
try {
  const v = fs.readFileSync(here("VARIANCE.md"), "utf8");
  const g = (re) => (v.match(re) || [])[1];
  const runs = g(/\((\d+) runs/), good = g(/Correct results submitted per run: ([\d.]+ \(range [^)]+\))/), hold = g(/HOLD per run: ([\d.]+ \(range [^)]+\))/), bad = g(/Defective results submitted per run: ([\d.]+ \(range [^)]+\))/);
  if (runs) VAR = `<p class="lead">Across ${runs} runs of the same 40 cases: defective results submitted per run ${bad}; correct results submitted ${good}; HOLD ${hold}. Details: <a href="https://github.com/swiftbotlabs/gig-guard/blob/main/eval/deliver/VARIANCE.md">VARIANCE.md</a>. The cards below show the first run.</p>`;
} catch {}
const NODE = process.env.TELEGRAPH_NODE || "https://devnode.telegraphprotocol.com";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const dec = new Map(); for (const x of L) if (x.kind === "decision" && x.gate === "deliver") dec.set(x.input?.name, x);
const buys = new Map(); for (const x of L) if (x.kind === "purchase" && x.receipt?.receipt_hash) buys.set(x.receipt.receipt_hash, x);
const checks = [];
const cards = cases.map((c) => {
  const d = dec.get(c.id); if (!d) return "";
  const right = c.truth === "done" ? d.verdict === "SUBMIT" : d.verdict !== "SUBMIT";
  const missing = d.local_missing || [];
  const free = (c.mustInclude || []).length ? (missing.length ? `missing: ${missing.map(esc).join(", ")}` : `present: ${c.mustInclude.map(esc).join(", ")}`) : "none for this task";
  const rc = (d.receipts || []).map((h) => { const b = buys.get(h) || {}; checks.push({ h, e: b.receipt?.epoch_id, i: b.intent, u: Number(b.amount_uusdc) });
    return `<li><code>${esc(b.intent)}</code> · miner ${esc(b.miner_id)} · $${esc(b.cost_usd)} · ${(Number(b.ms) / 1000).toFixed(1)} s · receipt <code title="${esc(h)}">${esc(h.slice(0, 14))}…</code> epoch ${esc(b.receipt?.epoch_id)} <span class="st ${esc(ver[h] || "")}" data-h="${esc(h)}">${esc(ver[h] || "")}</span></li>`; }).join("");
  const failedPaid = (d.evidence || []).flatMap((e) => e.tried || []).filter((t) => t.error).map((t) => `<li>${esc(t.intent)}: ${esc(String(t.error).slice(0, 120))}</li>`).join("");
  return `<article class="case ${c.truth} ${right ? "right" : "wrong"}" data-truth="${c.truth}" data-v="${esc(d.verdict)}">
<header><b>${esc(c.id)}</b><span class="truth">${c.truth === "done" ? "result does the task" : `planted defect: ${esc(c.defect || "")}`}</span><span class="v ${esc(d.verdict)}">${esc(d.verdict)}</span><span class="ok">${right ? "expected verdict" : "not the expected verdict"}</span></header>
<div class="grid"><div><h4>Task</h4><pre>${esc(c.task)}</pre></div><div><h4>Agent's output</h4><pre>${esc(c.result)}</pre></div></div>
<p><b>Free required-items check:</b> ${free}</p>
<p><b>Paid judgement and gate:</b> ${esc((d.reasons || []).join(" · "))}${(d.uncertainty || []).length ? ` <span class="unc">uncertain: ${esc(d.uncertainty.join("; "))}</span>` : ""}</p>
<ul>${rc || "<li>no paid answer (nothing was charged)</li>"}${failedPaid}</ul></article>`;
}).join("\n");
const data = JSON.stringify({ node: NODE, checks }).replace(/</g, "\\u003c");
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Done-check replay</title>
<style>
:root{--onacc:#ffffff;--bg:#fbfbf9;--card:#fff;--fg:#16171a;--mut:#62666d;--line:#e3e3df;--ok:#0a7d3b;--bad:#b3261e;--warn:#8a5a00;--acc:#2f5bd3;--code:#f3f3ef}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--onacc:#0b1020;--bg:#121316;--card:#1a1b1f;--fg:#ececea;--mut:#9a9da3;--line:#2c2e33;--ok:#5fd38d;--bad:#ff8a80;--warn:#ffcc66;--acc:#8fb0ff;--code:#22242a}}
:root[data-theme="dark"]{--onacc:#0b1020;--bg:#121316;--card:#1a1b1f;--fg:#ececea;--mut:#9a9da3;--line:#2c2e33;--ok:#5fd38d;--bad:#ff8a80;--warn:#ffcc66;--acc:#8fb0ff;--code:#22242a}
*{box-sizing:border-box}body{background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;margin:0 auto;max-width:1040px;padding:24px 16px}
h1{font-size:1.6rem;margin:0 0 4px}p.lead{color:var(--mut);margin:0 0 16px;max-width:72ch}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:0 0 16px}.tile{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px}.tile b{display:block;font-size:1.35rem;font-variant-numeric:tabular-nums}.tile span{color:var(--mut);font-size:.85rem}
.bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 14px}button{font:inherit;background:var(--card);color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:7px 12px;cursor:pointer}button.pri{background:var(--acc);color:var(--onacc);border-color:var(--acc)}button[aria-pressed="true"]{border-color:var(--acc);color:var(--acc)}#vs{color:var(--mut)}
.case{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:0 0 10px}.case header{display:flex;flex-wrap:wrap;gap:10px;align-items:baseline}.truth{color:var(--mut);font-size:.9rem}.ok{margin-left:auto;font-size:.85rem;color:var(--mut)}.wrong .ok{color:var(--warn);font-weight:600}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media (max-width:640px){.grid{grid-template-columns:1fr}}h4{margin:8px 0 4px;font-size:.8rem;color:var(--mut);text-transform:uppercase;letter-spacing:.04em}
pre{background:var(--code);border-radius:6px;padding:8px;margin:0;white-space:pre-wrap;word-break:break-word;font-size:.85rem}p{margin:8px 0}ul{margin:4px 0 0;padding-left:18px;color:var(--mut);font-size:.88rem}
.v{font-weight:700}.SUBMIT{color:var(--ok)}.FIX{color:var(--bad)}.HOLD{color:var(--warn)}.unc{color:var(--warn)}.st{font-weight:600}.st.SETTLED{color:var(--ok)}.st.MISMATCH{color:var(--bad)}.st.PENDING{color:var(--warn)}
code{font-size:.82rem}footer{color:var(--mut);font-size:.85rem;margin-top:16px}a{color:var(--acc)}
</style>
<h1>Done-check replay</h1>
<p class="lead">Before an agent tells a client "done", Gig Guard buys an independent judgement of the actual output from Telegraph Miners (TASK_EXECUTION_QUALITY_GENERAL), checks the client's required items for free, and returns SUBMIT, FIX or HOLD. These are the 40 known-answer cases of the testnet run: 20 tasks, each with an output that does it and one with a planted defect. Testnet only (Ethereum Sepolia escrow, test USDC).</p>
<div class="tiles">
<div class="tile"><b>${S.not_done_submitted} / ${S.not_done_total}</b><span>defective outputs submitted</span></div>
<div class="tile"><b>${S.done_submitted} / ${S.done_total}</b><span>good outputs submitted</span></div>
<div class="tile"><b>$${Number(S.cost_per_decided_usd).toFixed(3)}</b><span>per decision ($${Number(S.cost_usd).toFixed(2)} total)</span></div>
<div class="tile"><b>${S.latency_p50_s} s</b><span>median answer time</span></div>
</div>
${VAR}
<p class="lead" id="hs">Hosted done-check (no wallet): <a href="https://donecheck.swiftbotlab.workers.dev">donecheck.swiftbotlab.workers.dev</a>.</p>
<div class="bar"><button class="pri" id="vb" type="button">Check receipts live</button><span id="vs">Asks the Telegraph node whether each receipt is in its settled epoch block. No wallet, no key.</span></div>
<div class="bar" role="group" aria-label="Filter"><button type="button" data-f="all" aria-pressed="true">All 40</button><button type="button" data-f="not_done" aria-pressed="false">Planted defects</button><button type="button" data-f="done" aria-pressed="false">Good outputs</button><button type="button" data-f="wrong" aria-pressed="false">Not the expected verdict</button></div>
<main id="cases">${cards}</main>
<footer>Each case's task and output are the repo's <code>eval/deliver/cases.json</code>; the judgement and receipts are its public ledger <code>eval/deliver/ledger.public.jsonl</code>. Status shown before you press the button: the repo's last receipt check. Rebuild: <code>node eval/deliver/score.mjs && node eval/deliver/replay.mjs</code>. Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC.</footer>
<script>
const D=${data};
document.querySelectorAll("[data-f]").forEach(b=>b.onclick=()=>{const f=b.dataset.f;document.querySelectorAll("[data-f]").forEach(x=>x.setAttribute("aria-pressed",x===b));
document.querySelectorAll(".case").forEach(c=>{c.hidden=!(f==="all"||c.dataset.truth===f||(f==="wrong"&&c.classList.contains("wrong")))})});
fetch("https://donecheck.swiftbotlab.workers.dev/api/stats").then(r=>r.json()).then(s=>{if(typeof s.checks==="number")document.getElementById("hs").insertAdjacentText("beforeend"," Checks run there so far: "+s.checks+" ("+s.judged+" with a paid judgement), counts only, no personal data.")}).catch(()=>{});
document.getElementById("vb").onclick=async()=>{const vs=document.getElementById("vs");const n={SETTLED:0,PENDING:0,MISMATCH:0,OTHER:0};vs.textContent="checking "+D.checks.length+" receipts…";
for(const c of D.checks){let s="OTHER";try{const r=await fetch(D.node+"/v1/blocks/"+c.e+"/deliveries/"+c.h);const j=await r.json();
if(r.ok){const d=j.delivery||{};s=(d.intent===c.i&&Number(d.usdc)===c.u)?"SETTLED":"MISMATCH"}else if(/no block recorded/.test(j.error||""))s="PENDING";}catch(e){}
n[s]++;document.querySelectorAll('.st[data-h="'+c.h+'"]').forEach(el=>{el.textContent=s;el.className="st "+s});}
vs.textContent=n.SETTLED+" settled, "+n.PENDING+" pending, "+n.MISMATCH+" mismatched, "+n.OTHER+" not checked";};
</script></html>`;
fs.writeFileSync(out, html);
console.log(JSON.stringify({ out, cases: cases.filter((c) => dec.has(c.id)).length, receipts: checks.length }));
