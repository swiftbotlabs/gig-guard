# Stop your agent saying "done" when it isn't: a paid done-check in one line

Agents report success too easily. This tutorial adds one step before your agent tells anyone a task is finished:
- it buys an independent judgement of the actual result against the task from Telegraph Miners;
- it checks the client's must-have items for free;
- it only says "done" when the verdict is SUBMIT.

Testnet only: Ethereum Sepolia escrow, Telegraph test USDC, no real money. On our 40-case run each check cost about $0.01 and took 13 s (median).

No wallet? Try the hosted check first: paste a task and a result, and you get the verdict and a receipt (testnet, paid from our own throwaway testnet payer): https://donecheck.swiftbotlab.workers.dev

## 0. What you need
- **Node.js 20 or newer.** We test on Node 22.22. Check with `node --version`.
- **git.**
- **About 10 minutes.**
- **Section 1 needs no key and no funds.** Sections 2-4 need a testnet-only key with a little Sepolia ETH for gas.

## 1. Install and run it offline (no key, no funds)
```bash
git clone https://github.com/swiftbotlabs/gig-guard && cd gig-guard
npm install && npm test          # 56 tests against a fake Telegraph node
node examples/m09-demos.mjs      # stale answer, no budget, failed payment, conflicting answers, consent
node examples/fix-loop.mjs --offline
```
Expected: `# pass 56`, `# fail 0`. The last command ends with `SUBMIT after one redo; total $0.02`.

## 2. Make a testnet key and fund an escrow balance
```bash
node -e 'const {generatePrivateKey,privateKeyToAccount}=require("viem/accounts");const k=generatePrivateKey();console.log(k, privateKeyToAccount(k).address)'
```
1. The command prints a key and an address. Never reuse a key that has ever held real funds.
2. Send a little Sepolia ETH to the address from any public Sepolia faucet. It is only used for gas: about 0.001 is plenty.
3. Create `.env` in the repo folder:
   ```bash
   TELEGRAPH_PAYER_KEY=0x<the key from step 1>
   GG_RAIL=escrow
   ```
4. Fund the escrow balance. This one command mints 1 Telegraph test USDC (a public mint), approves the Telegraph Diamond and deposits:
   ```bash
   set -a; . ./.env; set +a
   node examples/fund-escrow.mjs 1
   ```
   Sample output:
   ```
   mint: 0x… status success
   approve: 0x… status success
   depositUSDC: 0x… status success
   deposited 1 test USDC for 0x…; it is usable from the next ledger block (a few minutes)
   ```
   That deposit pays for about 100 checks. If you prefer Foundry, the same three calls with `cast` are in [`TUTORIAL.md`](TUTORIAL.md), step 2.

## 3. Guard the "done" step
The input is one JSON object:
- `task` (or `taskFile`): what the client asked for.
- `result` (or `resultFile`): what your agent produced. `task` plus `result` must stay within 2,000 characters; longer work is held, not cut.
- `mustInclude` (optional): strings that must appear in the result. Checked for free.
- `patch` (optional): `owner/repo@<sha>` for pushed code. It adds a `CODE_PATCH_VERIFY_GENERAL` check on the CI run.

```bash
node src/cli.mjs deliver '{"task":"Write a one-line JavaScript expression that is true when the string s has at least 12 characters.","result":"s.length > 12"}' \
  && echo "tell the client: done" || echo "not done: fix it or ask a human"
```
Sample output (a real testnet answer from our run, case password-rule/bad):
```json
{
  "verdict": "FIX",
  "uncertainty": [],
  "reasons": [
    "judge: fails (score ?). Fail - the expression uses > instead of >=, so it is true only for strings longer than 12 characters, not for those with exactly 12."
  ],
  "receipts": [
    "0xd09d6414207fa20765843d1fa26577f758b83b084d38360015aea4fcdc0a4cf4"
  ],
  "cost_usd": 0.01,
  "ms": 8027
}
not done: fix it or ask a human
```
Exit codes: 0 = SUBMIT, 10 = FIX or HOLD, 1 = error. How it decides:
- It buys `TASK_EXECUTION_QUALITY_GENERAL` with `{task, result}` (fallback `LLM_OUTPUT_EVALUATION_GENERAL`), offering the judge's $0.01 price.
- A pass from the judge with a missing `mustInclude` item is FIX, and the conflict is shown in `uncertainty`.
- If no judgement could be bought, or the verdict is null or "partially_satisfies", the result is HOLD. It fails closed: unknown is never success.
- Every paid answer is written to `ledger.jsonl`, with its receipt. Each receipt can be checked against Telegraph's settled epoch blocks with `node src/cli.mjs verify`.

## 4. Close the loop: redo on FIX
```bash
node examples/fix-loop.mjs
```
Our live testnet run is shown below. The full transcript is in [`FIX-LOOP.md`](FIX-LOOP.md).
```
check 1: FIX  $0.01  receipt 0x69af6cd3…  | judge: fails (score ?). the total row shows 210.00 instead of the correct sum of 220.00
check 2: SUBMIT  $0.01  receipt 0xb6b732ce…  | judge: satisfies (score ?)
SUBMIT after one redo; total $0.02
```

## 5. Measure it on your own cases
Write cases with a known answer, one result that does the task and one with a planted defect, in the shape of [`eval/deliver/cases.json`](../eval/deliver/cases.json):
`{"id":"x/good","task":"…","result":"…","mustInclude":[],"truth":"done"}`. Then run:
```bash
GG_LEDGER=my.jsonl GG_REUSE=0 node eval/deliver/run.mjs    # stops at once (exit 3) with the deposit it needs if escrow runs dry
GG_LEDGER=my.jsonl node eval/deliver/score.mjs             # judge alone vs the gate, cost and latency per decision
GG_LEDGER=my.jsonl node src/cli.mjs verify my-receipts.json
```
Our run on 40 cases is in [`eval/deliver/RESULTS.md`](../eval/deliver/RESULTS.md). Every case can be replayed, with its receipts, at https://apps.swiftbotlab.workers.dev/gig-guard/replay.

## What we learned
- The judge's `score` is not a quality score: a correct "fails" came with score 10. Read the verdict, not the score.
- The judge sometimes contradicts itself: verdict null, or "fails" with a reason that says the result is correct. Treat that as HOLD, never SUBMIT.
- On the escrow rail, the node reserves your whole `max_budget_usdc` per request until the next epoch block. Offer the price you expect to pay, not your cap. Otherwise a funded balance looks empty (402 `insufficient escrow`).
- A signed request that fails can still be billed (Telegraph issue #228). Gig Guard logs it with the amount and counts it toward your caps.
