# Gig Guard

**A paid safety gate for an autonomous freelance agent.** An agent that earns crypto from bounties and hackathons loses money in three places: it chases bounties from sponsors who never pay, it submits code with holes in it, and it lets owed prizes go unclaimed. Gig Guard puts a paid, verifiable check in front of each of those moves. The agent buys ranked intelligence from the Telegraph network, pays for it itself, checks it against a free independent source where one exists, and a written policy decides. Every decision keeps its receipts, and anyone can check those receipts against Telegraph's settled epoch blocks.

**Testnet only.** Ethereum Sepolia escrow, Telegraph test USDC. No real money moves, and nothing here is production usage.

Demo video (2 min 44 s, a real run, long waits sped up and labelled): [`docs/gig-guard-demo.mp4`](docs/gig-guard-demo.mp4). Public ledger: [`ledger.html`](ledger.html).

| Gate | Mission | What it buys from Telegraph | Free cross-check | Decisions |
|---|---|---|---|---|
| `scout`: a new bounty shows up in the agent's heartbeat | 09 Personal Agent | `URL_SCAN_VERDICT` (fallback `URL_SAFE_GENERAL`), `WEB_SEARCH_GENERAL` (fallback `NEWS_SEARCH_GENERAL`) on the sponsor's payout record | sources must actually mention the sponsor | GO / CAUTION / SKIP |
| `ship`: a contract or code deliverable is about to be submitted | 14 Web3 Native & DeFi (whitehat) | `SECURITY_REVIEW_GENERAL`, `CODE_REVIEW_GENERAL` | local Solidity rules (SWC-104/106/107/112/115/120) | SHIP / FIX / HOLD |
| `claim`: an awarded prize is overdue | 15 Consumer Automation | `WALLET_BALANCE_CHECK_GENERAL` (or `ONCHAIN_TX_LOOKUP_GENERAL` for a tx), `CONTRACT_OBLIGATION_AUDIT_GENERAL` on the terms | public RPC `balanceOf` | PAID / CLAIM (letter drafted, waits for the user's yes) / PENDING |

## What a run looks like

Live, 2026-11-18 08:41 UTC, one heartbeat over a queue of 7 items (output trimmed; full log in [`docs/demo-run.txt`](docs/demo-run.txt)):

```
bounty-1: CAUTION  ($0.02, 2 receipts, 19.4 s)
  - no independent record of Sponsor T paying winners (5 sources, none mention it)
deliverable-1: FIX  ($0.02, 2 receipts, 66.4 s)
  - security: null (2) CWE-863, CWE-841
  - confirmed by local rules: tx.origin used for auth (SWC-115); state written after external call (SWC-107 reentrancy)
deliverable-2: SHIP  ($0.02, 2 receipts, 121.3 s)
prize-a: CLAIM  ($0.01, 1 receipt, 10.3 s)  next: awaiting user approval
  - chain read agrees (0); wallet holds 0 USDT on ethereum: prize of $400 not received
prize-a-declined: CLAIM  ($0.00, reused answer, 0.1 s)  next: declined by user: not sent
prize-x: PENDING  (0 usable receipts, 17.7 s)
  - no miner returned a USDT balance on tron: chain or token likely unsupported, not claiming without proof
bad-input: refused before paying: wallet must be a 0x address
```

Receipt check right after (`gig-guard verify`): 21 receipts, 13 SETTLED in epoch 8's block, 8 PENDING because epoch 9 was still open, 0 mismatched.

## Why you can trust a verdict

- **Receipts anyone can check.** Each escrow receipt is looked up at `GET /v1/blocks/{epoch_id}/deliveries/{receipt_hash}` on the Telegraph node. SETTLED means the epoch block lists the delivery with the same intent and amount. `gig-guard verify` does this from the CLI, and the public ledger page has a **Check receipts live** button that does it from the viewer's browser, with no wallet.
- **A miner's answer is not the last word.** Balances are re-read from a public RPC; if the miner disagrees with the chain, the chain wins and the disagreement is shown. Security findings are marked "confirmed by local rules" or "miner-only". If the miners pass a contract but a local rule fires, it goes back as FIX.
- **Uncertainty is visible.** Every decision carries an `uncertainty` list: single source, disagreement, stale reading, earlier policy version.
- **Consent before acting.** A claim letter is a draft. Without `"approved": true` it waits; with `"approved": false` it's dropped. Gig Guard never sends anything itself.
- **Fail closed.** No proof means PENDING or HOLD, never a claim or a ship. Bad input is refused before any payment. A paid answer that comes back empty or stale is not evidence; it's logged (and counted in the cost) and the next supplier is tried.

## Cost per useful outcome

- About $0.01 per answer, $0.02 per gate.
- Fresh facts are reused instead of bought twice: balances for 10 minutes, link scans for 24 h, searches for 6 h, reviews of identical code for 7 days. A reused answer costs $0 and points to the original receipt.
- The ledger page reports spend, reuse, median latency and **cost per useful decision** (spend divided by decisions the agent could act on), all computed from the ledger.
- Hard caps, checked before signing: `GG_MAX_PER_CALL` (default $0.03) and `GG_MAX_PER_DAY` (default $1.00).

## Cost per verified correct answer (Mission 10)

`gig-guard report report.md report.json` grades every paid answer in the ledger with a check that does not trust the miner, then prices each Intent and miner by what a *correct* answer actually cost.

| Grade | Meaning |
|---|---|
| correct | An independent check agrees: the free public-RPC balance read for balances, the deterministic local rules for Solidity reviews (a flag the rules back, or a pass where no rule fires). |
| incorrect | An independent check contradicts it: a balance the chain disagrees with, or a review that passes code where a local rule fires. |
| empty | Paid, but the needed fields came back empty or stale (partial or unanswerable). |
| unconfirmed | The miner flagged something no local rule backs: not proven right or wrong. |
| unknown | No independent check exists for this Intent yet (link scans, web search). Never counted as correct. |

Cost per verified correct answer = paid spend ÷ correct answers, per Intent and miner and in total (also over checkable spend only). Wasted answers from skipped suppliers are included; reused answers and free chain reads are not. The output names miners and Intents only, no wallets.

Limits: the local rules are a short list, so "passed, and no rule fires" is agreement with a weak check, not proof of safety. Link scans and web searches stay "unknown" until there is a truth source for them.

## Run it

Prerequisites: Node.js 20+, and a **testnet-only** key with a Telegraph escrow balance on Ethereum Sepolia (see [`docs/TUTORIAL.md`](docs/TUTORIAL.md), step 2: mint test USDC, approve, `depositUSDC`).

```bash
npm install
npm test                                   # 22 tests against a fake node: no network, no funds
cp .env.example .env && $EDITOR .env       # TELEGRAPH_PAYER_KEY=0x... (testnet only)
set -a; . ./.env; set +a

node src/cli.mjs scout https://example.org/bounty "Example Sponsor" 500
node src/cli.mjs ship samples/Vault.sol                 # FIX
node src/cli.mjs ship samples/SafeVault.sol             # SHIP
node src/cli.mjs claim '{"wallet":"0x...","chain":"ethereum","token":"USDT","sponsor":"Example Sponsor","label":"Prize A","prizeUsd":400,"dueDate":"2026-11-15"}'
node src/cli.mjs heartbeat examples/queue.example.json results.json   # what the agent runs every cycle
node src/cli.mjs verify verify.json                     # check every receipt against settled epoch blocks
node src/cli.mjs ledger ledger.html verify.json         # public page (redacted)
node src/cli.mjs export ledger.public.jsonl             # public copy of the ledger (redacted)
node src/cli.mjs report report.md report.json           # Mission 10: cost per verified correct answer
```

Exit codes: 0 = go (GO/PAID/SHIP), 10 = stop and look, 1 = error. That makes each gate a one-line guard in any shell loop: `node src/cli.mjs ship out/C.sol && submit || echo held`.

## Privacy

`ledger.jsonl` is private: it holds sponsor names, prize wallets and claim letters because the agent needs them. It is git-ignored and never published. The public page and `export` replace sponsor names with neutral labels (a queue item's `label`, else "Sponsor A", "Sponsor B"), shorten wallets and tx hashes, replace every link with `[link]`, and drop raw answers and claim letters. Receipt hashes stay, so every decision remains checkable.

## Payment rails

- `GG_RAIL=escrow` (default): prepaid test-USDC balance on the Telegraph Diamond (Ethereum Sepolia). One EIP-191 signature per request; receipts settle per 3-hour epoch.
- `GG_RAIL=x402`: x402 `exact` on Base Sepolia with Circle test USDC, gasless for the payer. On 2026-11-18 the public facilitator listed no EVM testnet signer and every settlement timed out (nothing was charged), so live runs use escrow.
- Optional, `ANJOMAN_API_KEY` set: the scout gate also delegates one sponsor investigation ("is this sponsor real, and has it paid its winners?") to the Anjoman agent through an API key. The account's prepaid balance pays the miner calls the agent makes; each task is capped by `GG_DELEGATE_MAX_USD` (default $0.05, sent as `maxSpendUsd`) and counted against the daily cap. The task's status, cost, job id and any step receipt hashes go into the ledger as `ANJOMAN_AGENT_TASK`. Its answer counts like a search answer: it still needs sources that name the sponsor, and it can stand in when the search miners return nothing. A failed task only adds a reason to the verdict. Off when the key is unset.

## Gaps found while building

Written up as found, with the workaround in the code:

1. The public x402 facilitator has no EVM testnet signer, so `exact` settlements time out. Workaround: escrow rail.
2. `max_budget_usdc` is rejected on the Base Sepolia x402 rail. Workaround: dropped on that rail.
3. `SMART_CONTRACT_AUDIT_GENERAL` and `CRYPTO_TRANSFER_VERIFY_GENERAL` have no published response schema; answers come back as untyped free text with no receipt. Workaround: `CODE_REVIEW_GENERAL` as the second review.
4. `WEB_SEARCH_GENERAL` returns sources with a null answer for question-style queries. Workaround: keyword queries.
5. One `SECURITY_REVIEW_GENERAL` miner returns `verdict: null` with real CWE findings. Workaround: counted issues mean FIX.
6. `WALLET_BALANCE_CHECK_GENERAL` on BNB Smart Chain returns all-null fields when the token is a symbol, and a real balance when it's the contract address. Workaround: USDT/USDC contract map for six chains, contract asked first.
7. The deliveries Merkle proof uses sorted-pair keccak256 (verified against epoch 7), but the leaf encoding isn't documented, so the proof can't be folded from the delivery fields alone. Workaround: membership and field match against the settled block; the proof length and roots are recorded.

## Tests

`npm test` runs 22 tests (19 policy + 3 report) against a fake Telegraph node that speaks the real 402 challenge, signed retry and receipt headers, plus a fake RPC and fake epoch blocks. Covered: each verdict of each gate, supplier fallback, empty and stale answers, a miner contradicted by the chain, consent given/declined/absent, reuse without a second charge, local-rule corroboration, receipt SETTLED/PENDING/MISMATCH, bad input refused before payment, and that public output never leaks sponsor names, wallets, links or claim text.

## Limits

- The sponsor check reads web sources through miners: it flags risk, it doesn't prove fraud.
- A balance can't tell a prize from other deposits; pass the sponsor's announced tx hash when there is one.
- Reviews read the first 12 KB of a deliverable. The local rules are a short list, not an auditor.
- Verdicts are only as good as the ranked miners behind each Intent; the ledger keeps the miner id so a bad answer can be traced.
- No independent users yet: every run so far is our own agent's.

## License

MIT
