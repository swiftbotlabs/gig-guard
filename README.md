# Gig Guard

**A paid safety gate for an autonomous freelance agent.** An agent that earns crypto from paid jobs loses money in three places: it takes on work from clients who never pay, it submits code with holes in it, and it lets overdue payments go unchased. Gig Guard puts a paid, verifiable check in front of each of those moves. The agent buys ranked intelligence from the Telegraph network, pays for it itself, checks it against a free independent source where one exists, and a written policy decides. Every decision keeps its receipts, and anyone can check those receipts against Telegraph's settled epoch blocks.

**Testnet only.** Ethereum Sepolia escrow, Telegraph test USDC. No real money moves, and nothing here is production usage.

Demo video (2 min 45 s, the 10:21 UTC run below, long waits sped up and labelled): https://apps.swiftbotlab.workers.dev/proof/gig-guard-demo.mp4. Public ledger: [`ledger.html`](ledger.html).

| Gate | Mission | What it buys from Telegraph | Free cross-check | Decisions |
|---|---|---|---|---|
| `scout`: a new job lead shows up in the agent's heartbeat | 09 Personal Agent | `URL_SCAN_VERDICT` (fallback `URL_SAFE_GENERAL`), `WEB_SEARCH_GENERAL` (fallback `NEWS_SEARCH_GENERAL`) on the client's payment record | sources must name the client | GO / CAUTION / SKIP |
| `ship`: a contract or code deliverable is about to be submitted | 14 Web3 Native & DeFi (whitehat) | `SECURITY_REVIEW_GENERAL`, `CODE_REVIEW_GENERAL` | local Solidity rules (SWC-104/106/107/112/115/120) | SHIP / FIX / HOLD |
| `deliver`: the agent is about to tell its client "done" | 09 Personal Agent | `TASK_EXECUTION_QUALITY_GENERAL` (fallback `LLM_OUTPUT_EVALUATION_GENERAL`) on the task and the actual result; `CODE_PATCH_VERIFY_GENERAL` on the commit's CI when code was pushed | the client's required items must appear in the result | SUBMIT / FIX / HOLD |
| `claim`: an agreed payment is overdue | 15 Consumer Automation | `WALLET_BALANCE_CHECK_GENERAL` (or `ONCHAIN_TX_LOOKUP_GENERAL` for a tx), `CONTRACT_OBLIGATION_AUDIT_GENERAL` on the terms | public RPC `balanceOf` | PAID / CLAIM (letter drafted, waits for the user's yes) / PENDING |

## What a run looks like

Live, 2026-11-18 10:21 UTC, one heartbeat over a queue of 7 items, the run shown in the demo video (output trimmed; full log in [`docs/demo-run.txt`](docs/demo-run.txt)). Every paid answer in it is in the public ledger ([`ledger.public.jsonl`](ledger.public.jsonl), page [`ledger.html`](ledger.html)) with its receipt:

```
bounty-1: CAUTION  ($0.02, 2 receipts, 66.3 s)
  - no independent record of Sponsor T paying winners (5 sources, none mention it)
deliverable-1: FIX  ($0.02, 2 receipts, 66.7 s)
  - security: null (2) CWE-863, CWE-841
  - confirmed by local rules: tx.origin used for auth (SWC-115); state written after external call (SWC-107 reentrancy)
deliverable-2: SHIP  ($0.02, 2 receipts, 93.1 s)
prize-a: CLAIM  ($0.01, 1 receipt, 8.7 s)  next: awaiting user approval
  - chain read agrees (0); wallet holds 0 USDT on ethereum: prize of $400 not received
prize-a-declined: CLAIM  ($0.00, reused answer, 0.3 s)  next: declined by user: not sent
prize-x: PENDING  ($0.01, 0 usable receipts, 20.6 s)
  - no miner returned a USDT balance on tron (1 paid answer came back empty): not claiming without proof
bad-input: refused before paying: wallet must be a 0x address
```

The whole public ledger (this run plus the first live run at 07:19 UTC) holds 10 decisions and 12 paid answers, $0.12. Receipt check re-run on 2026-11-20 (`gig-guard verify`, saved as [`receipts-verify.json`](receipts-verify.json)): 12 receipts, 12 SETTLED (4 in epoch 8, 8 in epoch 9), 0 pending, 0 mismatched.

## Why you can trust a verdict

- **Receipts anyone can check.** Each escrow receipt is looked up at `GET /v1/blocks/{epoch_id}/deliveries/{receipt_hash}` on the Telegraph node. SETTLED means the epoch block lists the delivery with the same intent and amount. `gig-guard verify` does this from the CLI, and the public ledger page has a **Check receipts live** button that does it from the viewer's browser, with no wallet.
- **A miner's answer is not the last word.** Balances are re-read from a public RPC; if the miner disagrees with the chain, the chain wins and the disagreement is shown. Security findings are marked "confirmed by local rules" or "miner-only". If the miners pass a contract but a local rule fires, it goes back as FIX.
- **Uncertainty is visible.** Every decision carries an `uncertainty` list: single source, disagreement, stale reading, earlier policy version.
- **Consent before acting.** A claim letter is a draft. Without `"approved": true` it waits; with `"approved": false` it's dropped. Gig Guard never sends anything itself.
- **Fail closed.** No proof means PENDING or HOLD, never a claim or a ship. Bad input is refused before any payment. A paid answer that comes back empty or stale is not evidence; it's logged (and counted in the cost) and the next supplier is tried.

## Cost per useful outcome

- About $0.01 per answer, $0.02 per gate.
- Fresh facts are reused instead of bought twice: balances for 10 minutes, link scans for 24 h, searches for 6 h, reviews of identical code for 7 days. A reused answer costs $0 and points to the original receipt.
- The ledger page reports spend, reuse, median latency and **cost per useful decision** (spend divided by decisions the agent could act on: GO, CAUTION, SKIP, SHIP, FIX, CLAIM, PAID; PENDING and HOLD don't count), all computed from the ledger. On the public ledger: $0.12 over 8 useful decisions = $0.015, median answer time 14.4 s.
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

Cost per verified correct answer = paid spend ÷ correct answers, per Intent and miner and in total. "Over checkable spend" counts only the answers a check could grade (correct, incorrect, empty): on the public ledger 6 answers, $0.06, 5 correct = $0.012. The public ledger keeps the part of each answer the grading needs (a balance and its date, the free chain read, a review's verdict and findings), so `GG_LEDGER=ledger.public.jsonl node src/cli.mjs report` reproduces [`docs/cost-per-correct.md`](docs/cost-per-correct.md) exactly ([`docs/TRY-IT.md`](docs/TRY-IT.md)). Wasted answers from skipped suppliers are included; reused answers and free chain reads are not. The output names miners and Intents only, no wallets.

Disclosure: miner 731001, the best-graded `SECURITY_REVIEW_GENERAL` miner in our report, is the provider run by another H2 entrant (PR Guard). Telegraph's ranking assigned it to our requests; we have no arrangement with it and grade it like every other miner.

Limits: the local rules are a short list, so "passed, and no rule fires" is agreement with a weak check, not proof of safety. Link scans and web searches stay "unknown" until there is a truth source for them.

## Run it

Prerequisites: Node.js 20+, and a **testnet-only** key with a Telegraph escrow balance on Ethereum Sepolia (see [`docs/TUTORIAL.md`](docs/TUTORIAL.md), step 2: mint test USDC, approve, `depositUSDC`).

```bash
npm install
npm test                                   # 41 tests against a fake node: no network, no funds
cp .env.example .env && $EDITOR .env       # TELEGRAPH_PAYER_KEY=0x... (testnet only)
set -a; . ./.env; set +a

node src/cli.mjs scout https://example.org/job "Example Client" 500
node src/cli.mjs ship samples/Vault.sol                 # FIX
node src/cli.mjs ship samples/SafeVault.sol             # SHIP
node src/cli.mjs deliver '{"task":"Export the invoices to CSV with a totals row","resultFile":"out/invoices.csv","mustInclude":["total"]}'
node src/cli.mjs claim '{"wallet":"0x...","chain":"ethereum","token":"USDT","sponsor":"Example Client","label":"Payment A","prizeUsd":400,"dueDate":"2026-11-15"}'
node src/cli.mjs heartbeat examples/queue.example.json results.json   # what the agent runs every cycle
node src/cli.mjs verify verify.json                     # check every receipt against settled epoch blocks
node src/cli.mjs ledger ledger.html verify.json         # public page (redacted)
node src/cli.mjs export ledger.public.jsonl             # public copy of the ledger (redacted)
node src/cli.mjs report report.md report.json           # Mission 10: cost per verified correct answer
```

Exit codes: 0 = go (GO/PAID/SHIP/SUBMIT), 10 = stop and look, 1 = error. That makes each gate a one-line guard in any shell loop: `node src/cli.mjs ship out/C.sol && submit || echo held`.

## Docs

- [`docs/TUTORIAL.md`](docs/TUTORIAL.md): pay for verified intelligence from an agent loop in 10 minutes.
- [`docs/TUTORIAL-with-vs-without.md`](docs/TUTORIAL-with-vs-without.md): add paid answers to a decision step, then measure with `compare` whether they changed anything.
- [`docs/TUTORIAL-done-check.md`](docs/TUTORIAL-done-check.md): a paid done-check before your agent says "done", and how to measure it on your own cases.
- [`docs/M09-DEMOS.md`](docs/M09-DEMOS.md): Mission 09's five failure tests (stale local answer, no budget, failed payment, conflicting provider answer, permission for external effects), run offline with `node examples/m09-demos.mjs`.
- [`eval/deliver/RESULTS.md`](eval/deliver/RESULTS.md): the deliver gate on 40 known-answer cases (testnet), with cost and latency per decision.
- [`docs/compare.md`](docs/compare.md): our own run, 10 real decisions with and without paid answers.

## Privacy

`ledger.jsonl` is private: it holds client names, payout wallets and claim letters because the agent needs them. It is git-ignored and never published. The public page and `export` replace client names with neutral labels (a queue item's `label`, else "Client A", "Client B"), shorten wallets and tx hashes, replace every link with `[link]`, and drop raw answers and claim letters. Receipt hashes stay, so every decision remains checkable.

## Planted-bug run (2026-11-20)

[`eval/`](eval/): 12 Solidity contracts with a known answer (8 with one planted bug, 4 clean) through the ship gate on testnet. Gate: 5 bugs caught, 1 missed, 2 false alarms on clean code, 3 held because no review could be bought. 13 of 24 requests failed with no charge (security review route: 10 of 12, mostly HTTP 500 deadline errors). The code-review miner's own text named 3 of the bugs we counted as missed, so our parser is the next fix. $0.11, answer latency p50 29.4 s, p95 38.3 s. Details and every receipt: [`eval/README.md`](eval/README.md), [`eval/RESULTS.md`](eval/RESULTS.md).

## Try it in 5 minutes

[`docs/TRY-IT.md`](docs/TRY-IT.md): no wallet or funds. `npm test`, then check all 12 receipts against the Telegraph testnet node and recompute the cost report from the public ledger. Tell us what happened with the **Tried it** issue template.

## Mainnet: what would change

Nothing has been spent on mainnet. What it would take, as of 2026-11-20:

- **A mainnet payment route.** The node we use (`devnode.telegraphprotocol.com`) offers only testnet routes: its 402 challenge on 2026-11-20 listed x402 `exact` on Base Sepolia and Solana devnet, and escrow on Ethereum Sepolia ([`docs/node-402-2026-11-20.json`](docs/node-402-2026-11-20.json)). Mainnet waits on a mainnet route from Telegraph.
- **Code, once it exists:** set `TELEGRAPH_NODE` and `TELEGRAPH_NETWORK`, add the mainnet USDC address to `config.assets` and its explorer to `config.explorers`, and let the escrow rail read its network from config instead of the fixed `eip155:11155111` in `src/telegraph.mjs`. Gates, policy, ledger and the receipt check stay as they are.
- **Already on mainnet data:** the claim gate's free cross-check reads real balances from public mainnet RPCs on six chains (the 10:25 UTC claim read USDT on Ethereum mainnet).
- **Money and keys:** the same hard caps apply (`GG_MAX_PER_CALL` $0.03, `GG_MAX_PER_DAY` $1.00). At today's prices the 12 answers on the ledger would cost $0.12 in real USDC. Use a dedicated low-balance key, never a treasury key.
- **Still missing for production:** a truth source for link and web answers (they stay "unknown" in the report) and outside users (none yet).

## Payment rails

- `GG_RAIL=escrow` (default): prepaid test-USDC balance on the Telegraph Diamond (Ethereum Sepolia). One EIP-191 signature per request; receipts settle per 3-hour epoch.
- `GG_RAIL=x402`: x402 `exact` on Base Sepolia with Circle test USDC, gasless for the payer. On 2026-11-18 the public facilitator listed no EVM testnet signer and every settlement timed out (nothing was charged), so live runs use escrow.
- Optional, scout gate only: `ANJOMAN_API_KEY` (an Anjoman account key, testnet) delegates a whole **client investigation** to the Anjoman agent (`POST /agent/chat`). The account's escrow balance pays the miner calls it makes. Each task is capped by `GG_DELEGATE_MAX_USD` (default $0.05, sent as `maxSpendUsd`) and by the daily cap. Its answer is just more evidence: it counts only when its sources name the client, and a failed or partial task is logged as unavailable, never as a clean record. The ledger keeps the job id and cost. Off when the key is unset.

## Gaps found while building

Written up as found, with the workaround in the code:

1. The public x402 facilitator has no EVM testnet signer, so `exact` settlements time out. Workaround: escrow rail.
2. `max_budget_usdc` is rejected on the Base Sepolia x402 rail. Workaround: dropped on that rail.
3. `SMART_CONTRACT_AUDIT_GENERAL` and `CRYPTO_TRANSFER_VERIFY_GENERAL` have no published response schema; answers come back as untyped free text with no receipt. Workaround: `CODE_REVIEW_GENERAL` as the second review.
4. `WEB_SEARCH_GENERAL` returns sources with a null answer for question-style queries. Workaround: keyword queries.
5. One `SECURITY_REVIEW_GENERAL` miner returns `verdict: null` with real CWE findings. Workaround: counted issues mean FIX.
6. `WALLET_BALANCE_CHECK_GENERAL` on BNB Smart Chain: asked with the token symbol, our request got no answer (ledger 07:19, nothing charged, verdict PENDING); asked with the USDT contract address it returned a balance (ledger 07:29, receipt `0x191054b8…`, verdict CLAIM). In unledgered development runs the symbol form came back with all-null fields. Workaround: USDT/USDC contract map for six chains, contract asked first.
7. The deliveries Merkle proof uses sorted-pair keccak256 (verified against epoch 7), but the leaf encoding isn't documented, so the proof can't be folded from the delivery fields alone. Workaround: membership and field match against the settled block; the proof length and roots are recorded.
8. On the escrow rail the node reserves each request's whole `max_budget_usdc` until the next epoch block, so a high cap exhausts a
   funded balance early (402 `insufficient escrow ... unbilled=U + price=P > balance=B`). Workaround: the judge is offered its $0.01 price,
   and the 402 stops the run with the shortfall instead of being logged as HOLD.
9. A signed request that fails (an error status or no response) can still be billed (Telegraph issue #228). Workaround: it is logged as `signed` with `charged_uusdc` (the signed amount, worst case), the daily cap counts it and so does the decision's cost; a 402 `insufficient escrow` is refused before delivery and counts nothing.

## Tests

`npm test` runs 41 tests (24 policy, 7 escrow rail, 3 report, 4 review parser, 3 contract-fitting) against a fake Telegraph node that speaks the real 402 challenge, signed retry and receipt headers, plus a fake RPC and fake epoch blocks. Covered: each verdict of each gate, supplier fallback, empty and stale answers, a miner contradicted by the chain, consent given/declined/absent, reuse without a second charge, local-rule corroboration, receipt SETTLED/PENDING/MISMATCH, an exhausted escrow balance that stops a run without logging false HOLDs, a signed request that fails but may still be billed (issue #228: logged, counted by the cap and in the decision's cost), bad input refused before payment, and that public output never leaks sponsor names, wallets, links or claim text.

## Limits

- The client check reads web sources through miners: it flags risk, it doesn't prove fraud.
- A balance can't tell one payment from other deposits; pass the client's announced tx hash when there is one.
- Reviews read the first 12 KB of a deliverable. The local rules are a short list, not an auditor.
- Verdicts are only as good as the ranked miners behind each Intent; the ledger keeps the miner id so a bad answer can be traced.
- No independent users yet: every run so far is our own agent's.

## License

MIT
