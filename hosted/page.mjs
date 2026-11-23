// The hosted done-check page: one form, the verdict, the receipt and a live receipt check. Inline CSS/JS only (CSP in worker.mjs).
export const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Gig Guard done-check</title>
<meta name="description" content="Paste a task and an agent's result: a paid Telegraph judge decides SUBMIT, FIX or HOLD, with a receipt you can check. Testnet.">
<style>
:root{--bg:#fbfbf9;--card:#fff;--fg:#16171a;--mut:#5d6168;--line:#e3e3df;--ok:#0a7d3b;--bad:#b3261e;--warn:#8a5a00;--acc:#2f5bd3;--code:#f3f3ef}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#121316;--card:#1a1b1f;--fg:#ececea;--mut:#a0a3a9;--line:#2c2e33;--ok:#5fd38d;--bad:#ff8a80;--warn:#ffcc66;--acc:#8fb0ff;--code:#22242a}}
:root[data-theme="dark"]{--bg:#121316;--card:#1a1b1f;--fg:#ececea;--mut:#a0a3a9;--line:#2c2e33;--ok:#5fd38d;--bad:#ff8a80;--warn:#ffcc66;--acc:#8fb0ff;--code:#22242a}
*{box-sizing:border-box}body{background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;margin:0 auto;max-width:860px;padding:28px 16px}
h1{font-size:1.7rem;margin:0 0 6px}p.lead{color:var(--mut);margin:0 0 18px;max-width:68ch}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin:0 0 14px}
label{display:block;font-weight:600;margin:10px 0 4px}label small{font-weight:400;color:var(--mut)}
textarea,input{width:100%;font:15px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--code);color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:10px}
textarea{min-height:96px;resize:vertical}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:12px}
button{font:inherit;border-radius:8px;padding:9px 14px;cursor:pointer;border:1px solid var(--line);background:var(--card);color:var(--fg)}
button.pri{background:var(--acc);border-color:var(--acc);color:#fff;font-weight:600}button:disabled{opacity:.6;cursor:wait}
#count,#budget{color:var(--mut);font-size:.9rem}
.verdict{font-size:2rem;font-weight:800;letter-spacing:.02em}.SUBMIT{color:var(--ok)}.FIX{color:var(--bad)}.HOLD{color:var(--warn)}
ul{margin:6px 0 0;padding-left:20px}li{margin:2px 0}.mut{color:var(--mut);font-size:.9rem}.unc{color:var(--warn)}
code{font:13px ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all}.st{font-weight:700}.SETTLED{color:var(--ok)}.PENDING{color:var(--warn)}.MISMATCH{color:var(--bad)}
footer{color:var(--mut);font-size:.85rem;margin-top:18px}a{color:var(--acc)}
</style></head><body>
<h1>Done-check</h1>
<p class="lead">Before an agent tells a client "done", it should check the actual result, not its own claim of success. Paste a task and the result an agent produced. A paid Telegraph Miner judges it (<code>TASK_EXECUTION_QUALITY_GENERAL</code>), your required items are checked for free, and you get SUBMIT, FIX or HOLD with a receipt you can check against Telegraph's settled blocks. Testnet only: we pay with test USDC from a throwaway testnet wallet. You need no wallet.</p>
<div class="card">
<label for="task">Task <small>what the client asked for</small></label>
<textarea id="task" maxlength="1900" placeholder="Export these invoices to CSV with a final row 'total' with the sum: INV-1 120.00, INV-2 80.50"></textarea>
<label for="result">Agent's result <small>what the agent produced</small></label>
<textarea id="result" maxlength="1900"></textarea>
<label for="must">Must include <small>optional, comma separated, checked for free (up to 5)</small></label>
<input id="must" maxlength="400" placeholder="total,200.50">
<div class="row"><button class="pri" id="go" type="button">Check it</button><button type="button" id="exGood">Example: correct</button><button type="button" id="exBad">Example: planted defect</button><span id="count"></span></div>
<p class="mut">Don't paste secrets or personal data: the text goes to Telegraph Miners for judging. Nothing you paste is stored by this page. <span id="budget"></span></p>
</div>
<div class="card" id="out" hidden aria-live="polite"></div>
<footer>Gig Guard, by Swift Bot Labs. Code and the 40-case evaluation: <a href="https://github.com/swiftbotlabs/gig-guard">github.com/swiftbotlabs/gig-guard</a>. Replay of every evaluated case: <a href="https://apps.swiftbotlab.workers.dev/gig-guard/replay">gig-guard/replay</a>. Limits: 5 checks per connection per day, a small shared daily testnet budget; when it is used up the check says so and spends nothing.</footer>
<script>
const $=id=>document.getElementById(id), esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const EX={task:"Write a one-line JavaScript expression that is true when the string s has at least 12 characters.",good:"s.length >= 12",bad:"s.length > 12"};
$("exGood").onclick=()=>{$("task").value=EX.task;$("result").value=EX.good;$("must").value="";cnt()};
$("exBad").onclick=()=>{$("task").value=EX.task;$("result").value=EX.bad;$("must").value="";cnt()};
const cnt=()=>{const n=$("task").value.length+$("result").value.length;$("count").textContent=n+" / 2000 characters";$("count").style.color=n>2000?"var(--bad)":""};
$("task").oninput=cnt;$("result").oninput=cnt;cnt();
fetch("/api/budget").then(r=>r.json()).then(b=>{if(b.left_usd!=null)$("budget").textContent="Shared testnet budget left today: $"+b.left_usd.toFixed(2)+" of $"+b.cap_usd.toFixed(2)+"."}).catch(()=>{});
$("go").onclick=async()=>{const o=$("out");const must=$("must").value.split(",").map(s=>s.trim()).filter(Boolean);
$("go").disabled=true;o.hidden=false;o.innerHTML="<p>Buying a judgement from a Telegraph Miner… (usually 10 to 30 s)</p>";
try{const r=await fetch("/api/check",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({task:$("task").value,result:$("result").value,mustInclude:must})});
const d=await r.json();if(!r.ok){o.innerHTML="<p class='unc'>"+esc(d.error||("HTTP "+r.status))+"</p>";return}
let h="<div class='verdict "+esc(d.verdict)+"'>"+esc(d.verdict)+"</div><p class='mut'>"+({SUBMIT:"The agent may report this as done.",FIX:"Not done: send it back to be fixed.",HOLD:"Not a clear pass: a human decides. Unknown is never reported as success."}[d.verdict]||"")+"</p><ul>"+d.reasons.map(x=>"<li>"+esc(x)+"</li>").join("")+"</ul>";
if(d.uncertainty&&d.uncertainty.length)h+="<p class='unc'>Uncertain: "+esc(d.uncertainty.join("; "))+"</p>";
if(d.receipt){h+="<p class='mut'>Paid "+esc(d.judge.intent)+", miner "+esc(d.receipt.miner_id)+", $"+(d.receipt.amount_uusdc/1e6).toFixed(2)+(d.ms?", "+(d.ms/1000).toFixed(1)+" s":"")+". Receipt <code>"+esc(d.receipt.receipt_hash)+"</code>, epoch "+esc(d.receipt.epoch_id)+": <span class='st' id='st'>not checked</span> <button type='button' id='ck'>Check receipt</button></p><p class='mut'>A receipt is listed in Telegraph's epoch block once that block is recorded (up to a few hours); until then it shows PENDING.</p>"}
else h+="<p class='mut'>No paid answer, nothing charged beyond signed requests ($"+Number(d.cost_usd).toFixed(2)+").</p>";
o.innerHTML=h;const ck=$("ck");if(ck)ck.onclick=async()=>{const st=$("st");st.textContent="checking…";let s="OTHER";
try{const e=String(d.receipt.epoch_id),hh=String(d.receipt.receipt_hash);if(!/^\\d{1,9}$/.test(e)||!/^0x[0-9a-fA-F]{64}$/.test(hh))throw 0;
const q=await fetch(d.node+"/v1/blocks/"+encodeURIComponent(e)+"/deliveries/"+encodeURIComponent(hh));const j=await q.json();
if(q.ok){const x=j.delivery||{};s=(String(x.receipt_hash||hh).toLowerCase()===hh.toLowerCase()&&x.intent===d.receipt.intent&&Number(x.usdc)===d.receipt.amount_uusdc)?"SETTLED":"MISMATCH"}else if(/no block recorded/.test(j.error||""))s="PENDING"}catch(e){}
st.textContent=s;st.className="st "+s};
if(d.budget_left_usd!=null)$("budget").textContent="Shared testnet budget left today: $"+d.budget_left_usd.toFixed(2)+".";
}catch(e){o.innerHTML="<p class='unc'>The check could not be reached. Nothing was charged to you.</p>"}finally{$("go").disabled=false}};
</script></body></html>`;
