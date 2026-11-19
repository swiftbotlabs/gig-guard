// Renders "with vs without Telegraph" (about 90 s, 1280x720) from a REAL comparison of the ledger:
//   node src/cli.mjs compare docs/compare.md docs/compare.json
//   node docs/make_compare_video.mjs docs/compare.json docs/with-vs-without.mp4
// Every number and row on screen comes from compare.json (which is already redacted and neutral).
// Needs playwright (chromium) and ffmpeg.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const [inFile = "docs/compare.json", outFile = "docs/with-vs-without.mp4"] = process.argv.slice(2);
const C = JSON.parse(fs.readFileSync(inFile, "utf8"));
const T = C.totals;
const rows = C.rows.filter((r) => r.paid_answers > 0 || r.failures.length || r.reused); // decisions where Telegraph was involved
const fails = [...new Set(C.rows.flatMap((r) => r.failures))].slice(0, 5);
const over = C.rows.filter((r) => r.overturned);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const day = (C.rows[0]?.ts || "").slice(0, 10);
const cls = (v) => (/FIX|SKIP|CLAIM/.test(v) ? "bad" : /SHIP|GO|PAID/.test(v) ? "ok" : "warn");

const rowHtml = rows.map((r, i) => `<tr id="r${i}" class="${r.changed_now ? "chg" : ""}"><td>${esc(r.gate)}</td><td>${esc(r.label)}</td>
<td><b class="${cls(r.without.verdict)}">${esc(r.without.verdict)}</b><div class="why">${esc(r.without.why.slice(0, 90))}</div></td>
<td><b class="${cls(r.with.verdict)}">${esc(r.with.verdict)}</b><div class="why">${esc(r.with.why.slice(0, 70))}</div></td>
<td>${r.overturned ? `<b class="${cls(r.now.verdict)}">${esc(r.now.verdict)}</b><div class="why">${esc(r.now.why.slice(0, 70))}</div>` : '<span class="mut">same</span>'}</td>
<td>${r.paid_answers}${r.reused ? ` <span class="mut">+${r.reused} reused</span>` : ""}</td><td>$${r.cost_usd.toFixed(2)}</td></tr>`).join("");

const html = `<!doctype html><meta charset="utf-8"><title>With vs without Telegraph</title>
<style>
html,body{margin:0;height:100%;background:#0f1115;color:#e9e9e6;font:21px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;overflow:hidden}
.scene{position:absolute;inset:0;display:none;padding:30px 56px;box-sizing:border-box}.scene.on{display:block}
h1{font-size:52px;margin:110px 0 12px;letter-spacing:-.5px}h2{font-size:30px;margin:0 0 10px}.mut{color:#9a9da3;font-size:.85em}
table{width:100%;border-collapse:collapse;font-size:14px}td,th{border-bottom:1px solid #2a2e36;padding:3px 7px;text-align:left;vertical-align:top}th{color:#9a9da3;font-weight:600}
tr{opacity:0;transition:opacity .4s}tr.in{opacity:1}tr.chg td{background:#18202e}.why{color:#9a9da3;font-size:11.5px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:270px}
.ok{color:#5fd38d}.bad{color:#ff8a80}.warn{color:#ffcc66}
.cap{position:absolute;left:56px;right:56px;bottom:16px;background:#1d2230;border:1px solid #33405e;border-radius:12px;padding:9px 16px;font-size:19px;min-height:26px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:26px 0}.stats div{background:#181b21;border:1px solid #2a2e36;border-radius:14px;padding:16px}.big{font-size:42px;font-weight:700}
li{margin:8px 0}code{background:#181b21;padding:2px 6px;border-radius:6px}
</style>
<div class="scene" id="s1"><h1>Same decisions, with and without Telegraph</h1>
<p style="font-size:26px;max-width:32em">Gig Guard is the safety gate of an autonomous freelance agent: before it takes a job, ships a contract or chases an overdue payment, it buys answers from Telegraph miners.</p>
<p class="mut" style="font-size:22px;max-width:36em">Below: real decisions from its testnet ledger (${esc(day)}). "Without" = the same policy using only the free checks it already has: local Solidity rules and a public-RPC balance read. Nothing is staged and nothing is re-run.</p></div>
<div class="scene" id="s2"><h2>${T.decisions} real decisions</h2><table><tr class="in"><th>gate</th><th>item</th><th>without Telegraph (free checks)</th><th>with Telegraph, at the time</th><th>today's policy, same evidence</th><th>paid answers</th><th>cost</th></tr>${rowHtml}</table><div class="cap" id="c2"></div></div>
<div class="scene" id="s3"><h2>What it bought</h2><div class="stats">
<div><span class="big">${T.changed} → ${T.changed_now}</span><br>decisions changed (at the time → after fixing our policy)</div><div><span class="big">${T.decisions - T.changed_now}</span><br>same verdict, now with evidence</div>
<div><span class="big">$${T.cost_usd.toFixed(2)}</span><br>total, test USDC</div><div><span class="big">${T.cost_per_changed_now_usd !== null ? "$" + T.cost_per_changed_now_usd.toFixed(2) : "n/a"}</span><br>per decision it really changed</div></div>
<ul><li>Job leads: the paid searches mostly returned links that never named the client. CAUTION either way, but now the agent knows why.</li>
<li>Contracts: local rules alone caught this sample's bugs. Telegraph added an independent review, which matters when no rule fires.</li>
<li>Payments: where the free chain read exists, the paid answer is a second source; where it doesn't, it is the only proof.</li></ul></div>
<div class="scene" id="s4"><h2>Where the paid answers failed</h2><ul>
${over.length ? `<li><b class="bad">${over.length} wrong GOs.</b> Our first policy said GO on empty answers and on one unsourced answer that, read properly, reported a missed payment. Today's policy needs a source that names the client, and replayed on the same evidence it overturns all ${over.length}.</li>` : ""}
<li><b class="warn">verdict: null.</b> One review miner returns no verdict while listing real CWE findings; a gate reading only the verdict would ship the vulnerable contract. Ours counts the findings.</li>
${fails.map((f) => `<li><b class="warn">Empty answer.</b> <span class="mut">Logged: ${esc(f.replace(/_GENERAL\b/g, "").replace(/_/g, " ").toLowerCase().slice(0, 140))}.</span></li>`).join("")}
<li><b class="warn">Settlement.</b> x402 exact settlement on the testnet facilitator timed out for days; the escrow rail kept working.</li></ul>
<p class="mut">Paid but empty or wrong answers are logged and counted in the cost, never treated as evidence.</p></div>
<div class="scene" id="s5"><h2>Try it</h2><ul style="font-size:24px"><li><code>npm install &amp;&amp; npm test</code>: offline, no funds</li><li><code>node src/cli.mjs compare</code>: this comparison, from your own ledger</li><li>Point it at your own job leads, contracts and invoices on testnet.</li></ul>
<p class="mut" style="margin-top:40px">Telegraph Season II entry (Apps &amp; Agents), with a prize incentive. Testnet only: Ethereum Sepolia escrow, test USDC, no real money. No independent users yet.</p></div>
<script>
function show(id){document.querySelectorAll(".scene").forEach(s=>s.classList.toggle("on",s.id===id));}
window.scene=(n)=>show(n);
window.row=(i,cap)=>{const r=document.getElementById("r"+i);if(r)r.classList.add("in");if(cap)document.getElementById("c2").textContent=cap;};
</script>`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ggcmp-"));
fs.writeFileSync(path.join(dir, "v.html"), html);
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {}); // CHROME=/usr/bin/google-chrome where playwright has no browser
// Stills + system ffmpeg (no Playwright video recorder needed): one screenshot per state, held for its duration.
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const shots = [];
const hold = async (s) => { await page.waitForTimeout(700); const f = path.join(dir, `f${String(shots.length).padStart(3, "0")}.png`); await page.screenshot({ path: f }); shots.push([f, s]); };
await page.goto("file://" + path.join(dir, "v.html"));
await page.evaluate(() => scene("s1")); await hold(11);
await page.evaluate(() => scene("s2")); await hold(1);
const capFor = (r) => r.overturned ? `${r.label}: we said ${r.with.verdict} on thin evidence. Today's policy says ${r.now.verdict}, same as without Telegraph.`
  : r.changed_now ? `${r.label}: ${r.without.verdict} without, ${r.now.verdict} with Telegraph, for $${r.cost_usd.toFixed(2)}.`
  : `${r.label}: same verdict (${r.now.verdict}), ${r.paid_answers ? `now backed by ${r.paid_answers} paid answer${r.paid_answers === 1 ? "" : "s"}` : r.reused ? "now backed by a reused paid answer (no second charge)" : "the paid lookup came back empty, so it stays unproven"}.`;
for (let i = 0; i < rows.length; i++) { const s = rows[i].overturned || rows[i].changed_now ? 4.5 : 2.6; await page.evaluate(([i, c]) => row(i, c), [i, capFor(rows[i])]); await hold(s); }
await hold(3);
await page.evaluate(() => scene("s3")); await hold(15);
await page.evaluate(() => scene("s4")); await hold(15);
await page.evaluate(() => scene("s5")); await hold(10);
await ctx.close(); await browser.close();
const list = shots.map(([f, s]) => `file '${f}'\nduration ${s}`).join("\n") + `\nfile '${shots.at(-1)[0]}'\n`;
fs.writeFileSync(path.join(dir, "list.txt"), list);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"), "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "22", "-movflags", "+faststart", outFile]);
console.log(JSON.stringify({ video: outFile, rows: rows.length, seconds: Math.round(11 + 1 + rows.reduce((s, r) => s + (r.overturned || r.changed_now ? 4.5 : 2.6), 0) + 3 + 15 + 15 + 10) }));
