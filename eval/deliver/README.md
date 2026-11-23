# Deliver gate: known-answer set

`cases.json`: 20 tasks a freelance agent gets (CSV export, JSON, code fixes, SQL, translation, summaries, unit conversion…). Each has
one result that does the task and one with a planted defect: a wrong total, a missing key, inverted logic, invented facts, an
unanchored regex, a reply that does the opposite, and so on. The truth is set by construction, not by a model.

- Run (Telegraph testnet, test USDC, at most $0.01 a case, cap $0.60):
  `GG_LEDGER=eval/deliver/ledger.deliver.jsonl GG_REUSE=0 node eval/deliver/run.mjs`
- Score: `GG_LEDGER=eval/deliver/ledger.deliver.jsonl node eval/deliver/score.mjs` writes RESULTS.md.
  - It scores the gate (SUBMIT / FIX / HOLD) and the paid judge on its own.
  - A defective result must never be SUBMIT. FIX and HOLD both stop the agent from claiming success.
- Two tasks carry a free local check (`mustInclude`). The scorer counts who stopped each defect: `judge_stopped_bad` (the paid judge said fails)
  and `caught_only_by_local` (the judge passed it, was unclear or had no answer, and only the free check stopped it).

## The run of 22 Nov 2026 (Telegraph testnet)

Result: [RESULTS.md](RESULTS.md). 34 of the 40 cases were decided; the last 6 (percent, css-center, password-rule, good and bad each) have not run yet,
because the process stopped at 17:27 UTC while writing the ledger. They run in the next pass.

- 17 defective results: 0 submitted. 15 were stopped by the judge's `fails`; 2 (csv-totals, readme-install) were stopped by the free
  required-items check alone, at 15:44-15:46 UTC, when no miner delivered a judgement.
- 17 good results: 15 submitted, 1 held, 1 sent back. The held one (bug-fix) got `verdict: null` with a reason that describes a correct fix;
  the sent-back one (csv-dedupe) got `verdict: fails` with a reason that says the result is correct. The `score` field is not a quality
  score: a correct `fails` on a defect also came with score 10 (unit-convert), so the gate does not use it.
- Cost: 32 paid answers, $0.32 test USDC. Receipts: 32 of 32 SETTLED in the node's epoch blocks, 0 mismatched
  ([receipts-verify.json](receipts-verify.json), checked 23 Nov).
- Three passes, all logged: [run-1.log](run-1.log) (15:44 UTC, first 10 cases judged, then HTTP 402 `insufficient escrow`: unbilled 4.98 + price 0.03 > balance 5.00 test USDC),
  [run-2.log](run-2.log) (16:12 UTC, still 402: the deposit is credited only in the next ledger block; those HOLD decisions were dropped
  before the next pass so the cases could be retried), [run-3.log](run-3.log) (17:21-17:27 UTC, the rest).
- Why it stalled: the gate sent the $0.03 per-call cap as `max_budget_usdc`, and the node counts that against the prepaid balance until
  the next epoch block bills it, although the judge answers at $0.01. Two code fixes since: the deliver gate now offers the judge $0.01
  (`GG_JUDGE_BUDGET`), a third of the reservation per request; and an `insufficient escrow` 402 is thrown as `EscrowFundsError`, so no HOLD
  is recorded for a case that was never judged and `run.mjs` stops at once (exit code 3) with the deposit it needs
  (test/escrow.test.mjs, 4 tests, checked against a planted regression).
- Every paid answer, redacted: [ledger.public.jsonl](ledger.public.jsonl). The full ledger stays private.
