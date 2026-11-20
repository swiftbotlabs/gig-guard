// Public output never carries real sponsor names, prize wallets, tx hashes or link targets.
// The private ledger.jsonl keeps them (the agent needs them); the page and `export` go through here.
// A queue item may set `label` ("Payment A"); otherwise clients become "Client A", "Client B", ... by first appearance.
import { readLedger } from "./ledger.mjs";

const PAYER = (process.env.GG_PAYER_PUBLIC || "").toLowerCase(); // our own payer address may stay visible
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const short = (h) => `${h.slice(0, 6)}…${h.slice(-4)}`;
// Already-neutral names ("Prize B", "hackathon prize A") are kept; generic words never count as a sponsor's name.
const NEUTRAL = /^((hackathon )?prize|sponsor|bounty)( [a-z0-9])?$/i;
const GENERIC = new Set(["prize", "prizes", "hackathon", "bounty", "sponsor", "team", "labs", "protocol", "network", "foundation", "chain", "finance", "season", "contest"]);

export function makeRedactor(entries = readLedger()) {
  const labels = new Map();
  // Explicit labels first (a queue item's "label"), then automatic ones by first appearance.
  for (const e of entries) {
    const s = e.kind === "decision" && e.input?.sponsor;
    if (s && e.input.label && !NEUTRAL.test(s.trim()) && !labels.has(s.toLowerCase())) labels.set(s.toLowerCase(), e.input.label);
  }
  for (const e of entries) {
    const s = e.kind === "decision" && e.input?.sponsor;
    if (s && !NEUTRAL.test(s.trim()) && s.trim().length >= 2 && !labels.has(s.toLowerCase())) labels.set(s.toLowerCase(), e.input.label || `Client ${String.fromCharCode(65 + labels.size)}`);
  }
  // Full names first, then distinctive single words (>= 4 letters) of each name.
  const rules = [];
  for (const [name, lab] of labels) {
    rules.push([new RegExp(`\\b${reEsc(name)}\\b`, "gi"), lab]);
    for (const w of name.split(/\s+/).filter((w) => w.length >= 4 && !GENERIC.has(w))) rules.push([new RegExp(`\\b${reEsc(w)}\\w*`, "gi"), lab]);
  }
  const text = (s) => {
    let t = String(s);
    t = t.replace(/https?:\/\/[^\s"'<>)]+/gi, "[link]"); // no sponsor or platform hosts in public output
    t = t.replace(/0x[0-9a-fA-F]{64}\b/g, (h) => short(h));            // tx hashes in inputs/reasons
    t = t.replace(/0x[0-9a-fA-F]{40}\b/g, (a) => (a.toLowerCase() === PAYER ? a : short(a)));
    for (const [re, lab] of rules) t = t.replace(re, lab);
    return t;
  };
  const deep = (v) => (typeof v === "string" ? text(v) : Array.isArray(v) ? v.map(deep) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)])) : v);
  const label = (sponsor) => labels.get(String(sponsor || "").toLowerCase());
  return { text, deep, label };
}

/** Public copy of the ledger: decisions without claim letters or raw answers, purchases without params or results. */
// The part of an answer the cost report needs to grade it (report.mjs), and nothing else: a balance and its date (no
// address), the free chain read's number, and a review's verdict and findings (redacted). Search and link answers stay out:
// they can name a client or a link, and the report grades them "unknown" anyway.
function gradable(x, R) {
  const r = x.result;
  if (!r || typeof r !== "object") return undefined;
  if (x.intent === "WALLET_BALANCE_CHECK_GENERAL") return { balance: r.balance, token_symbol: r.token_symbol, as_of: r.as_of };
  if (x.intent === "CHAIN_READ (free)") return { balance: r.balance };
  if (x.intent === "SECURITY_REVIEW_GENERAL" || x.intent === "CODE_REVIEW_GENERAL")
    return R.deep({ verdict: r.verdict, vulnerability_count: r.vulnerability_count, issues: r.issues, findings: r.findings });
  return undefined;
}

export function publicLedger(entries = readLedger()) {
  const R = makeRedactor(entries);
  return entries.map((e) => {
    if (e.kind === "purchase") {
      const { params, result, ...rest } = e;
      return { ...rest, payer: PAYER && e.payer?.toLowerCase() === PAYER ? e.payer : undefined, purpose: e.purpose };
    }
    if (e.kind === "decision") {
      const { claim, evidence, input, ...rest } = e;
      const { label: _l, termsText: _t, ...inp } = input || {};
      if (rest.uncertainty) rest.uncertainty = R.deep(rest.uncertainty);
      return { ...rest, input: R.deep({ ...inp, ...(inp.sponsor ? { sponsor: R.label(inp.sponsor) } : {}) }), reasons: (e.reasons || []).map(R.text),
        evidence: (evidence || []).map((x) => ({ intent: x.intent, ok: x.ok, miner_id: x.miner_id, cost_usd: x.cost_usd, reused: x.reused, error: x.error && R.text(x.error),
          result: gradable(x, R), tried: x.tried && x.tried.map((t) => ({ intent: t.intent, miner_id: t.miner_id, cost_usd: t.cost_usd, error: t.error && R.text(t.error) })) })), claim_drafted: !!claim };
    }
    if (e.kind === "reuse") return { ts: e.ts, kind: e.kind, intent: e.intent, of: e.of, age_s: e.age_s };
    return { ts: e.ts, kind: e.kind, intent: e.intent, error: e.error && R.text(e.error) };
  });
}
