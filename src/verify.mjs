// Third-party receipt check. Escrow receipts settle in the epoch's ledger block:
//   GET {node}/v1/blocks/{epoch_id}/deliveries/{receipt_hash}
// SETTLED  = the block lists this delivery with our payer, intent and amount.
// PENDING  = the epoch's block isn't recorded yet (testnet: up to ~1 h after the 3 h epoch window closes).
// MISMATCH = the node returned a delivery that doesn't match the receipt we were given.
import { config } from "./config.mjs";
import { readLedger } from "./ledger.mjs";

export async function verifyReceipt(rc, node = config.node) {
  const h = rc?.receipt_hash, e = rc?.epoch_id;
  if (!h || e === undefined) return { receipt_hash: h, status: "NO_EPOCH", note: "receipt has no epoch (x402 exact receipts settle by tx instead)" };
  let r, j;
  try { r = await fetch(`${node}/v1/blocks/${e}/deliveries/${h}`, { signal: AbortSignal.timeout(15000) }); j = await r.json(); }
  catch (err) { return { receipt_hash: h, epoch_id: e, status: "UNREACHABLE", note: String(err.message || err) }; }
  if (!r.ok) return { receipt_hash: h, epoch_id: e, status: /no block recorded/.test(j?.error || "") ? "PENDING" : "NOT_FOUND", note: j?.error };
  const d = j.delivery || {};
  const bad = [];
  if (rc.payer && d.payer?.toLowerCase() !== rc.payer.toLowerCase()) bad.push("payer");
  if (rc.intent && d.intent !== rc.intent) bad.push("intent");
  if (rc.amount_uusdc && Number(d.usdc) !== Number(rc.amount_uusdc)) bad.push("amount");
  return { receipt_hash: h, epoch_id: e, status: bad.length ? "MISMATCH" : "SETTLED", mismatch: bad, miner_id: d.miner_id, usdc: d.usdc,
    deliveries_root: j.deliveries_root, block_data_root: j.block_data_root, proof_len: (j.proof || []).length };
}
export async function verifyLedger(entries = readLedger()) {
  const out = [];
  for (const b of entries.filter((x) => x.kind === "purchase" && x.receipt?.receipt_hash)) out.push({ intent: b.intent, ...(await verifyReceipt(b.receipt)) });
  const n = (s) => out.filter((x) => x.status === s).length;
  return { total: out.length, settled: n("SETTLED"), pending: n("PENDING"), mismatch: n("MISMATCH"), other: out.length - n("SETTLED") - n("PENDING") - n("MISMATCH"), receipts: out };
}
