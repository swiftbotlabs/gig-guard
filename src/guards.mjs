// The three gates of an autonomous freelance agent. Each buys intelligence through Telegraph,
// applies a written policy, and returns a decision with the receipts attached.
//   scout  (Mission 09 Personal Agent): should the heartbeat loop spend effort on this job lead?
//   claim  (Mission 15 Consumer Automation): an agreed payment is overdue: prove it and draft the claim.
//   ship   (Mission 14 Web3 Native & DeFi, whitehat): is this contract/code deliverable safe to submit?
//   deliver (Mission 09 Personal Agent): did the agent actually do the task? Checked before it claims success.
import { ask } from "./telegraph.mjs";
import { deliverVerdict } from "./verdict.mjs";
export { deliverVerdict };
import { config } from "./config.mjs";
import { flagsCode, flagsSecurity } from "./report.mjs";
import { REVIEW_LIMIT, fitForReview, stripComments } from "./solsrc.mjs";
import { append, readLedger } from "./ledger.mjs";
import { chainBalance } from "./chain.mjs";
import { balanceQueries, normChain } from "./tokens.mjs";
import { delegate, delegateEnabled } from "./delegate.mjs";

// Fresh answers are reused instead of paying twice for the same fact (cost per useful outcome).
// TTL per Intent, in minutes; GG_REUSE=0 turns reuse off.
const TTL_MIN = { WALLET_BALANCE_CHECK_GENERAL: 10, ONCHAIN_TX_LOOKUP_GENERAL: 10, CRYPTO_TRANSFER_VERIFY_GENERAL: 10,
  URL_SCAN_VERDICT: 1440, URL_SAFE_GENERAL: 1440, WEB_SEARCH_GENERAL: 360, NEWS_SEARCH_GENERAL: 360,
  SECURITY_REVIEW_GENERAL: 10080, CODE_REVIEW_GENERAL: 10080, CONTRACT_OBLIGATION_AUDIT_GENERAL: 10080,
  TASK_EXECUTION_QUALITY_GENERAL: 10080, LLM_OUTPUT_EVALUATION_GENERAL: 10080, CODE_PATCH_VERIFY_GENERAL: 30 };
const STALE_MIN = 60; // a balance reading older than this is not evidence of "now"
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function reusable(intent, p, need) {
  if (process.env.GG_REUSE === "0" || !TTL_MIN[intent]) return null;
  const cutoff = Date.now() - TTL_MIN[intent] * 60000;
  const hit = readLedger().reverse().find((e) => e.kind === "purchase" && e.intent === intent && same(e.params, p) && Date.parse(e.ts) >= cutoff
    && e.result && (!need || (e.result[need] !== null && e.result[need] !== undefined && e.result[need] !== "")));
  return hit || null;
}
const stale = (r) => r?.as_of && Date.now() - Date.parse(r.as_of) > STALE_MIN * 60000;

// Buy from the first intent in the list that delivers (some intents have thin supply on testnet).
// `need` names the answer field that must be filled for the answer to count (e.g. "balance").
async function buy(intents, params, purpose, need, budget) {
  const tried = [];
  for (const [intent, p] of intents.map((i) => (Array.isArray(i) ? i : [i, params]))) {
    const hit = reusable(intent, p, need);
    if (hit) {
      append({ kind: "reuse", intent, purpose, of: hit.receipt?.receipt_hash, age_s: Math.round((Date.now() - Date.parse(hit.ts)) / 1000) });
      return { ok: true, intent, result: hit.result, receipt: hit.receipt, miner_id: hit.miner_id, cost_usd: 0, ms: 0, reused: hit.receipt?.receipt_hash, tried };
    }
    try {
      const r = await ask(intent, p, budget ? { purpose, budget } : { purpose });
      // A paid answer whose fields are all empty is no answer: note it and try the next supplier.
      const vals = Object.entries(r.result || {}).filter(([k]) => !Object.values(p).includes(r.result[k])).map(([, v]) => v);
      const filled = (v) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length);
      if (need ? !filled(r.result?.[need]) : !vals.some(filled)) { tried.push({ intent, error: "empty answer", receipt: r.receipt?.receipt_hash, cost_usd: r.cost_usd }); continue; }
      if (need && stale(r.result)) { tried.push({ intent, error: `stale answer (as_of ${r.result.as_of})`, receipt: r.receipt?.receipt_hash, cost_usd: r.cost_usd }); continue; }
      return { ok: true, intent, ...r, tried };
    }
    catch (e) {
      if (e.name === "BudgetError" || e.name === "EscrowFundsError") throw e;
      // A failed request that was signed may still be billed (issue #228): its worst-case cost counts toward the decision.
      tried.push({ intent, error: String(e.message || e).slice(0, 200), ...(e.charged_uusdc ? { cost_usd: e.charged_uusdc / 1e6, charged_uusdc: e.charged_uusdc } : {}) });
    }
  }
  return { ok: false, intent: intents.map((i) => (Array.isArray(i) ? i[0] : i)).join("|"), error: "no supplier delivered", tried };
}
function decide(gate, input, verdict, reasons, evidence, extra = {}) {
  const d = { kind: "decision", policy: POLICY, gate, input, verdict, reasons,
    receipts: evidence.filter((e) => e.ok).map((e) => e.receipt?.receipt_hash).filter(Boolean),
    // Paid-but-unusable answers cost money too: they count toward the decision cost (honest cost per outcome).
    cost_usd: evidence.reduce((s, e) => s + (e.ok ? Number(e.cost_usd || 0) : 0) + (e.tried || []).reduce((t, x) => t + Number(x.cost_usd || 0), 0), 0),
    wasted_receipts: evidence.flatMap((e) => (e.tried || []).map((x) => x.receipt).filter(Boolean)),
    ms: evidence.reduce((s, e) => s + (e.ms || 0), 0),
    evidence: evidence.map((e) => ({ intent: e.intent, ok: e.ok, result: e.result, error: e.error, tried: e.tried, miner_id: e.miner_id, cost_usd: e.cost_usd, reused: e.reused, source: e.source, job_id: e.job_id })),
    ...extra };
  append(d);
  return d;
}
const lc = (s) => String(s ?? "").toLowerCase();
export const POLICY = "v6"; // decisions record the policy version that made them

/** Mission 09: triage a job lead found by the agent's heartbeat. */
export async function scoutBounty({ url, sponsor, prizeUsd, label }) {
  const u = new URL(url); // invalid input costs nothing
  if (!sponsor) throw new Error("sponsor name required");
  const q = `${sponsor} hackathon bounty prize payout winners unpaid`; // keyword queries work far better than questions
  const ev = [
    await buy(["URL_SCAN_VERDICT", "URL_SAFE_GENERAL"], { url: u.href }, "scout"),
    await buy([["WEB_SEARCH_GENERAL", { query: q }], ["NEWS_SEARCH_GENERAL", { query: q }]], {}, "scout"),
  ];
  // Optional: delegate a sponsor investigation to the Anjoman agent (API key, capped). It only adds evidence:
  // its answer counts like a search answer, and still needs sources that name the sponsor.
  let inv = null;
  if (delegateEnabled()) {
    try {
      const d = await delegate(`Investigate "${sponsor}" as a bounty or hackathon sponsor. Is it a real organisation, and is there public evidence that it has paid, or failed to pay, its winners? Cite sources. Answer in under 120 words.`, { purpose: "scout" });
      inv = { intent: "ANJOMAN_AGENT_TASK", ok: d.ok, result: { status: d.status, brief: d.answer, sources: d.sources }, cost_usd: d.cost_usd, ms: d.ms, job_id: d.job_id,
        ...(d.ok ? {} : { error: `delegated task ${d.status}`, tried: [{ intent: "ANJOMAN_AGENT_TASK", error: `delegated task ${d.status}`, cost_usd: d.cost_usd }] }) };
    } catch (e) { if (e.name === "BudgetError" || e.name === "EscrowFundsError") throw e; inv = { intent: "ANJOMAN_AGENT_TASK", ok: false, error: String(e.message || e).slice(0, 200), tried: [] }; }
    ev.push(inv);
  }
  const { verdict, reasons } = scoutVerdict({ url: u.href, sponsor }, ev);
  return decide("scout", { url: u.href, sponsor, prizeUsd, label }, verdict, reasons, ev);
}

/** The scout policy as a pure function of the evidence, so a recorded decision can be replayed under today's policy. */
export function scoutVerdict({ url, sponsor }, ev) {
  const u = new URL(url);
  const [link, rep] = ev; const inv = ev.find((e) => e.intent === "ANJOMAN_AGENT_TASK") || null;
  const reasons = [];
  let verdict = "GO";
  const lv = lc(link.result?.verdict ?? link.result?.safe ?? link.result?.answer);
  if (!link.ok) { verdict = "CAUTION"; reasons.push("link reputation unavailable"); }
  else if (/malicious|phish|unsafe|false/.test(lv)) { verdict = "SKIP"; reasons.push(`link flagged: ${lv}`); }
  else if (/suspicious|unknown/.test(lv)) { verdict = "CAUTION"; reasons.push(`link ${lv}`); }
  const text = lc(`${rep.result?.brief ?? ""} ${rep.result?.answer ?? ""} ${inv?.ok ? inv.result.brief ?? "" : ""}`);
  if (inv && !inv.ok) reasons.push(`delegated sponsor investigation unavailable (${inv.error})`);
  const repOk = rep.ok || !!inv?.ok;
  if (!repOk) { if (verdict === "GO") verdict = "CAUTION"; reasons.push("client payment history unavailable"); }
  else {
    const srcs = [...(rep.ok ? rep.result?.sources || [] : []), ...(inv?.ok ? inv.result.sources || [] : [])].map(String);
    const key = lc(sponsor).split(/\s+/)[0];
    // Only sources count: an answer that names the sponsor with no source naming it is not a record (it can be made up).
    const relevant = srcs.filter((s) => lc(s).includes(key)).length;
    if (/(unpaid|never paid|not (been |yet )?paid|not (yet )?(received|been received)|still waiting|didn'?t pay|did not pay|no payout|scam|rug ?pull|withheld)/.test(text)) { if (verdict === "GO") verdict = "CAUTION"; reasons.push(`payout red flag${srcs.length ? "" : " (unsourced)"}: ${(rep.result?.brief || text).slice(0, 160)}`); }
    else if (!relevant) { if (verdict === "GO") verdict = "CAUTION"; reasons.push(`no independent record of ${sponsor} paying (${srcs.length} sources, none name it)`); }
    else reasons.push(`${relevant} of ${srcs.length} sources mention ${sponsor}; no non-payment reports: ${(rep.result?.brief || text).slice(0, 140)}`);
  }
  if (u.protocol !== "https:") { if (verdict === "GO") verdict = "CAUTION"; reasons.push("not HTTPS"); }
  return { verdict, reasons };
}

/** Mission 15: an agreed payment has not arrived. Verify on-chain, read the terms, and draft the claim. */
export async function claimPayout({ wallet, chain, token, txHash, sponsor, prizeUsd, termsText, dueDate, contact, label, approved }) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet || "")) throw new Error("wallet must be a 0x address");
  if (txHash && !/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new Error("tx hash must be 0x + 64 hex chars");
  const ev = [];
  const chk = txHash
    ? await buy([["ONCHAIN_TX_LOOKUP_GENERAL", { tx_hash: txHash, chain }], ["CRYPTO_TRANSFER_VERIFY_GENERAL", { tx_hash: txHash, chain }]], {}, "claim")
    : await buy(balanceQueries(wallet, chain, token || "").map((q) => ["WALLET_BALANCE_CHECK_GENERAL", q]), {}, "claim", "balance");
  ev.push(chk);
  if (termsText) ev.push(await buy([["CONTRACT_OBLIGATION_AUDIT_GENERAL", { contract: termsText.slice(0, 8000) }]], {}, "claim"));
  const reasons = [], uncertainty = []; let verdict;
  const r = chk.result || {};
  // Free, deterministic second source for balances: the chain itself.
  const onchain = txHash ? null : await chainBalance(wallet, chain, token);
  if (onchain) ev.push({ ok: true, intent: "CHAIN_READ (free)", result: onchain, source: onchain.source, cost_usd: 0, ms: 0 });
  if (!chk.ok && onchain) uncertainty.push("paid balance check unavailable: decided on the free chain read alone");
  if (!chk.ok && !onchain) {
    verdict = "PENDING";
    const empty = chk.tried.filter((t) => t.error === "empty answer").length;
    reasons.push(empty
      ? `no miner returned a ${token || "native"} balance on ${normChain(chain)} (${empty} paid answer${empty > 1 ? "s" : ""} came back empty): chain or token likely unsupported, not claiming without proof`
      : `on-chain check unavailable on ${normChain(chain)}: not claiming without proof`);
  }
  else if (txHash) {
    const st = lc(r.status ?? r.answer);
    const mentionsUs = JSON.stringify(r).toLowerCase().includes(wallet.toLowerCase().slice(2));
    if (/confirm|success/.test(st) && mentionsUs) { verdict = "PAID"; reasons.push(`transfer ${txHash.slice(0, 10)}… confirmed to our wallet`); }
    else { verdict = "CLAIM"; reasons.push(`claimed tx ${txHash.slice(0, 10)}… is ${st || "unverified"}${mentionsUs ? "" : " and does not pay our wallet"}`); }
  } else {
    const minerBal = !chk.ok || r.balance === null || r.balance === undefined || r.balance === "" ? NaN : Number(r.balance);
    let bal = minerBal;
    if (onchain) {
      if (Number.isFinite(minerBal) && Math.abs(minerBal - onchain.balance) > Math.max(0.01, onchain.balance * 0.01)) {
        uncertainty.push(`miner answer ${minerBal} disagrees with the chain (${onchain.balance}): using the chain value`);
      } else if (Number.isFinite(minerBal)) reasons.push(`chain read agrees (${onchain.balance})`);
      bal = onchain.balance;
    } else if (chk.ok) uncertainty.push("single source: no free chain read for this chain/token");
    if (Number.isFinite(bal) && prizeUsd && bal >= prizeUsd) { verdict = "PAID"; reasons.push(`wallet holds ${bal} ${token || r.token_symbol || ""}, covers the prize`); }
    else { verdict = "CLAIM"; reasons.push(`wallet holds ${Number.isFinite(bal) ? bal : "?"} ${token || r.token_symbol || ""} on ${normChain(chain)} as of ${r.as_of || "now"}: payment of $${prizeUsd} not received`); }
  }
  const terms = ev.find((e) => e.intent === "CONTRACT_OBLIGATION_AUDIT_GENERAL");
  if (verdict === "CLAIM" && /\? /.test(reasons.join(" "))) uncertainty.push("balance unknown");
  if (terms?.ok) reasons.push(`terms: ${terms.result?.summary || (terms.result?.obligations || []).slice(0, 2).join("; ")}`);
  let claim;
  if (verdict === "CLAIM") {
    const rc = ev.filter((e) => e.ok && e.receipt).map((e) => `- ${e.intent}: receipt ${e.receipt?.receipt_hash}${e.receipt?.tx_hash ? ` (settlement tx ${e.receipt.tx_hash})` : ""}`).join("\n") + (onchain ? `\n- independent chain read: ${onchain.balance} via ${onchain.source}` : "");
    claim = `To: ${contact || sponsor + " prize team"}\nSubject: Unpaid prize: $${prizeUsd}${dueDate ? `, due ${dueDate}` : ""}\n\nHello ${sponsor} team,\n\nOur entry was awarded $${prizeUsd}${dueDate ? ` with payment due ${dueDate}` : ""}. As of ${new Date().toISOString().slice(0, 10)} it has not arrived at ${wallet} on ${chain}.\n\n${reasons.map((x) => "- " + x).join("\n")}\n\nIndependent evidence, bought from the Telegraph network (verifiable receipts):\n${rc}\n\nPlease send the payment or tell us what is still needed from our side.\n\nThank you.`;
  }
  // Consent: Gig Guard never sends anything. A claim is an action on the user's behalf, so it waits for a yes.
  const action = verdict !== "CLAIM" ? "none" : approved === true ? "approved: hand the letter to the mailer" : approved === false ? "declined by user: not sent" : "awaiting user approval";
  const rc = ev.filter((e) => e.ok && e.receipt).length;
  return decide("claim", { wallet, chain, token, txHash, sponsor, prizeUsd, dueDate, label }, verdict, reasons, ev,
    { ...(claim && approved !== false ? { claim } : {}), action, uncertainty, paid_receipts: rc });
}

// Deterministic local rules. A miner's finding is corroborated when one of these fires on the same code;
// otherwise it is marked "miner-only" so a human knows how much weight it carries.
const RULES = [
  [/tx\.origin/, "tx.origin used for auth (SWC-115)"],
  [/\.delegatecall\s*\(/, "delegatecall (SWC-112)"],
  [/selfdestruct\s*\(|suicide\s*\(/, "selfdestruct (SWC-106)"],
  [/^\s*(?!\(bool)[^\n=]*\.call(\{[^}]*\})?\([^\n]*\);/m, "low-level call result not checked (SWC-104)"],
  [/\.call\{value:[^}]*\}\([^)]*\);[\s\S]{0,200}?\b\w+\[[^\]]+\]\s*(=|-=)/, "state written after external call (SWC-107 reentrancy)"],
  [/block\.timestamp\s*%|blockhash\s*\(/, "weak randomness (SWC-120)"],
];
export const localFindings = (code) => RULES.filter(([re]) => re.test(code)).map(([, m]) => m);

/** Mission 14 (whitehat): may this contract/code deliverable be submitted? */
export async function shipCheck(code, { name = "deliverable" } = {}) {
  if (!code || !code.trim()) throw new Error("empty deliverable");
  const isSol = /pragma solidity|contract\s+\w+\s*\{/.test(code);
  const fit = fitForReview(code);
  if (!fit) {
    // Too long for the review Intents even without comments: nothing is sent or paid; fail closed.
    const local = isSol ? localFindings(code) : [];
    return decide("ship", { name, bytes: code.length, solidity: isSol }, "HOLD",
      [`too long to review: ${stripComments(code).length} characters without comments, over the ${REVIEW_LIMIT}-character limit of the review Intents; split the deliverable or review it another way`],
      [], { uncertainty: ["not reviewed"], local_findings: local });
  }
  const src = fit.text;
  const ev = [await buy([["SECURITY_REVIEW_GENERAL", { target: src }]], {}, "ship")];
  // SMART_CONTRACT_AUDIT_GENERAL has no published schema yet (answers come back as free text, no receipt),
  // so contracts get the typed CODE_REVIEW Intent as the second opinion.
  ev.push(await buy([["CODE_REVIEW_GENERAL", { code: src }]], {}, "ship"));
  const [sr, cr] = ev;
  const local = isSol ? localFindings(code) : [];
  const { verdict, reasons, uncertainty } = shipVerdict(sr, cr, local);
  return decide("ship", { name, bytes: code.length, solidity: isSol }, verdict, reasons, ev, { uncertainty, local_findings: local });
}

/** The ship decision from the two bought reviews and the local rules. Pure, so a stored run can be re-decided. */
export function shipVerdict(sr, cr, local) {
  const reasons = [], uncertainty = [];
  let verdict = "SHIP";
  if (!sr.ok && !cr.ok) { verdict = "HOLD"; reasons.push("no review could be bought: fail closed"); }
  if (sr.ok && flagsSecurity(sr.result)) { verdict = "FIX"; reasons.push(`security: ${sr.result.verdict} (${sr.result.vulnerability_count ?? "?"}) ${(sr.result.issues || []).slice(0, 5).join(", ")}`); }
  if (cr.ok && flagsCode(cr.result)) { verdict = "FIX"; reasons.push(`${cr.intent}: ${cr.result.verdict}. ${cr.result.summary || ""}`); }
  if (!reasons.length) reasons.push(`security: ${sr.ok ? sr.result.verdict : "n/a"}; ${cr.intent}: ${cr.ok ? cr.result.verdict : "n/a"}`);
  if (verdict === "FIX" && local.length) reasons.push(`confirmed by local rules: ${local.join("; ")}`);
  else if (verdict === "FIX") uncertainty.push("miner-only finding: no local rule fired; a human should confirm before rework");
  else if (verdict === "SHIP" && local.length) { verdict = "FIX"; reasons.push(`miners passed it, but local rules fired: ${local.join("; ")}`); uncertainty.push("miners and local rules disagree"); }
  if (verdict === "SHIP" && (!sr.ok || !cr.ok)) uncertainty.push("only one review could be bought");
  return { verdict, reasons, uncertainty };
}

// ---------------------------------------------------------------------------------------------------- deliver
// Before an agent tells its client "done", it checks the actual outcome, not its own claim of success:
//   1. a paid judge of the result against the task: TASK_EXECUTION_QUALITY_GENERAL (task, result) -> satisfies / partially_satisfies /
//      fails, falling back to LLM_OUTPUT_EVALUATION_GENERAL (task, output) -> Excellent..Fails;
//   2. for code pushed as a commit or PR: CODE_PATCH_VERIFY_GENERAL (patch) -> the CI conclusion, passed or not;
//   3. free local checks the client wrote down (`mustInclude`: strings that must appear in the result).
// SUBMIT only if every bought check passes and every local check holds. A disagreement between the judge and the local checks is
// shown as uncertainty and never resolved toward SUBMIT. Nothing bought -> HOLD (fail closed).
export const DELIVER_LIMIT = Number(process.env.GG_DELIVER_LIMIT || 2000); // characters of task + result sent to the judge
// The judge answers at $0.01. Sending the $0.03 per-call cap as max_budget_usdc made the node reserve 3x that against the escrow
// balance until each epoch block billed it (the 402 stall of 22 Nov), so the deliver gate offers $0.01 unless told otherwise.
export const JUDGE_BUDGET = Math.min(Number(process.env.GG_JUDGE_BUDGET || 10000), config.maxPerCall);

/** Mission 09 (Personal Agent): may the agent report this task as done? */
export async function deliverCheck({ task, result, patch, mustInclude = [], name = "deliverable" } = {}) {
  if (!task || !String(task).trim() || !result || !String(result).trim()) throw new Error("task and result are both required");
  const input = { name, task_chars: String(task).length, result_chars: String(result).length, patch: patch ? String(patch).slice(0, 200) : undefined };
  const missing = mustInclude.filter((m) => !String(result).includes(m));
  if (String(task).length + String(result).length > DELIVER_LIMIT) {
    return decide("deliver", input, "HOLD", [`too long to judge: task + result are ${String(task).length + String(result).length} characters, over ${DELIVER_LIMIT}; judge a summary or split the task`],
      [], { uncertainty: ["not judged"], local_missing: missing });
  }
  const ev = [await buy([["TASK_EXECUTION_QUALITY_GENERAL", { task, result }], ["LLM_OUTPUT_EVALUATION_GENERAL", { task, output: result }]], {}, "deliver", undefined, JUDGE_BUDGET)];
  if (patch) ev.push(await buy([["CODE_PATCH_VERIFY_GENERAL", { patch }]], {}, "deliver", "conclusion"));
  const { verdict, reasons, uncertainty } = deliverVerdict(ev[0], patch ? ev[1] : null, missing);
  return decide("deliver", input, verdict, reasons, ev, { uncertainty, local_missing: missing });
}


