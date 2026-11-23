# Stop your agent saying "done" when it isn't: a paid done-check in one line

Agents report success too easily. This tutorial adds one step before your agent tells anyone a task is finished: it buys an
independent judgement of the actual result against the task from Telegraph Miners, checks the client's must-have items for free,
and only says "done" on SUBMIT. Testnet only (Ethereum Sepolia escrow, Telegraph test USDC); about $0.01 and 15 s per check.

## 1. Install and run the tests (no funds)
```bash
git clone https://github.com/swiftbotlabs/gig-guard && cd gig-guard
npm install && npm test          # 38 tests against a fake node
node examples/m09-demos.mjs      # stale answer, no budget, failed payment, conflicting answers, consent: offline
```

## 2. Fund a testnet escrow balance
Follow [`TUTORIAL.md`](TUTORIAL.md) step 2 (mint Telegraph test USDC, approve, `depositUSDC`). Put the testnet-only key in `.env`.

## 3. Guard the "done" step
```bash
set -a; . ./.env; set +a
node src/cli.mjs deliver '{"task":"Export the invoices to CSV with a totals row","resultFile":"out/invoices.csv","mustInclude":["total"]}' \
  && echo "tell the client: done" || echo "not done: fix it or ask a human"
```
Exit code 0 = SUBMIT, 10 = FIX or HOLD, 1 = error. What it does:
- buys `TASK_EXECUTION_QUALITY_GENERAL` with `{task, result}` (fallback `LLM_OUTPUT_EVALUATION_GENERAL`), offering the judge's $0.01 price;
- checks every `mustInclude` string is in the result (free); a pass from the judge with a missing item is FIX, and the conflict is shown;
- for code you pushed, add `"patch":"owner/repo@<sha>"` and it also buys `CODE_PATCH_VERIFY_GENERAL` on the CI run;
- no judgement bought, a null verdict or "partially_satisfies" -> HOLD (fail closed: unknown is never success).

## 4. Measure it on your own cases
Write cases with a known answer (one result that does the task, one with a planted defect) in the shape of
[`eval/deliver/cases.json`](../eval/deliver/cases.json), then:
```bash
GG_LEDGER=my.jsonl GG_REUSE=0 node eval/deliver/run.mjs    # stops at once (exit 3) with the deposit it needs if escrow runs dry
GG_LEDGER=my.jsonl node eval/deliver/score.mjs             # judge alone vs the gate, cost and latency per decision
node src/cli.mjs verify my-receipts.json                   # each receipt against Telegraph's settled epoch blocks
```
Our run on 40 cases is in [`eval/deliver/RESULTS.md`](../eval/deliver/RESULTS.md).

## What we learned
- The judge's `score` is not a quality score: a correct "fails" came with score 10. Read the verdict, not the score.
- The judge sometimes contradicts itself (verdict null or "fails" with a reason that says the result is correct). Treat that as HOLD, never SUBMIT.
- On the escrow rail the node reserves your whole `max_budget_usdc` per request until the next epoch block. Offer the price you expect to
  pay, not your cap, or a funded balance looks empty (402 `insufficient escrow`).
