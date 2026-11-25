// The escrow payment message we are willing to sign, and nothing else. The node's 402 challenge carries a message template;
// we never sign the node's text as given. It must match the known template exactly (one amount, the pinned Telegraph Diamond as
// payee, Ethereum Sepolia, resource /v1/ask), and the message we sign is rebuilt here from that template with our own values.
// A bad or compromised node therefore cannot get a signature on any other text (e.g. a withdrawal-style authorization).
export const ESCROW_NETWORK = "eip155:11155111";
export const DIAMOND = "0x72a70e949362670bf8bcead24efc5b8f950aa08b";   // Telegraph devnode Diamond (Ethereum Sepolia)
const TEMPLATE = /^Telegraph Escrow Payment\n\nWallet: \{from\}\nPay To: (0x[0-9a-fA-F]{40})\nNetwork: (eip155:\d+)\nAmount: (\d{1,12}) uUSDC\nResource: (\/v1\/ask(?:\/\d{1,12})?)\nNonce: \{nonce\}\nValid After: \{validAfter\}\nValid Before: \{validBefore\}$/;

/** The template a node sends for `amount` μUSDC (also used by the tests' fake nodes). */
export const askResource = (minerId) => (minerId === undefined || minerId === null ? "/v1/ask" : `/v1/ask/${minerId}`);
export const challengeMessage = (amount, payTo = DIAMOND, network = ESCROW_NETWORK, minerId) =>
  `Telegraph Escrow Payment\n\nWallet: {from}\nPay To: ${payTo}\nNetwork: ${network}\nAmount: ${amount} uUSDC\nResource: ${askResource(minerId)}\nNonce: {nonce}\nValid After: {validAfter}\nValid Before: {validBefore}`;

/** Checks a 402 escrow option. Returns { amount, payTo } or throws with the reason. */
// The per-Miner route (/engine/v1/ask/{id}) says "Resource: /v1/ask/{id}": accepted only for the Miner id we asked for.
export function parseEscrowOption(opt, maxAmount, minerId) {
  const m = String(opt?.extra?.message ?? "").match(TEMPLATE);
  if (!m) throw new Error("escrow challenge message does not match the known template: not signing");
  const [, payTo, network, amountStr, resource] = m, amount = Number(amountStr);
  if (resource !== askResource(minerId)) throw new Error(`escrow resource ${resource} is not the route we asked (${askResource(minerId)}): not signing`);
  if (payTo.toLowerCase() !== DIAMOND || String(opt.payTo || "").toLowerCase() !== DIAMOND) throw new Error("escrow payee is not the Telegraph Diamond: not signing");
  if (network !== ESCROW_NETWORK || opt.network !== ESCROW_NETWORK) throw new Error("escrow network is not Ethereum Sepolia: not signing");
  if (!(amount > 0) || amount > maxAmount) throw new Error(`escrow quote ${amount} is outside 1..${maxAmount}`);
  return { amount, payTo: DIAMOND };
}

/** The exact message to sign, built locally. */
export const escrowMessage = ({ from, amount, nonce, validAfter, validBefore, minerId }) =>
  challengeMessage(amount, DIAMOND, ESCROW_NETWORK, minerId).replace("{from}", from).replace("{nonce}", nonce).replace("{validAfter}", validAfter).replace("{validBefore}", validBefore);
