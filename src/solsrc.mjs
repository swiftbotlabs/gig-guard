// Fitting a contract into the review Intents' input limit. Telegraph's SECURITY_REVIEW_GENERAL (`target`) and
// CODE_REVIEW_GENERAL (`code`) take at most 2,000 characters (node answer on testnet, 2026-11-21: "invalid_params: ... over
// the 2000 limit"). Comments and blank lines are removed first; the code itself is never cut.
export const REVIEW_LIMIT = Number(process.env.GG_REVIEW_LIMIT || 2000);

/** Solidity source without comments (string literals kept as written), trailing spaces or blank lines. */
export function stripComments(src) {
  let out = "", i = 0, q = null;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (q) {
      out += c;
      if (c === "\\" && n !== undefined) { out += n; i += 2; continue; }
      if (c === q || c === "\n") q = null;
      i++; continue;
    }
    if (c === '"' || c === "'") { q = c; out += c; i++; continue; }
    if (c === "/" && n === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && n === "*") { const end = src.indexOf("*/", i + 2); i = end < 0 ? src.length : end + 2; continue; }
    out += c; i++;
  }
  return out.split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim()).join("\n") + "\n";
}

/** {text, stripped} that fits the limit, or null when even the stripped code is longer. */
export function fitForReview(code, limit = REVIEW_LIMIT) {
  if (code.length <= limit) return { text: code, stripped: false };
  const s = stripComments(code);
  return s.length <= limit ? { text: s, stripped: true } : null;
}
