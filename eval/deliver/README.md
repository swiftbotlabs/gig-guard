# Deliver gate: known-answer set

`cases.json`: 20 tasks a freelance agent gets (CSV export, JSON, code fixes, SQL, translation, summaries, unit conversion…). Each has
one result that does the task and one with a planted defect: a wrong total, a missing key, inverted logic, invented facts, an
unanchored regex, a reply that does the opposite, and so on. The truth is set by construction, not by a model.

- Run (Telegraph testnet, test USDC, at most $0.01 a case, cap $0.60):
  `GG_LEDGER=eval/deliver/ledger.deliver.jsonl GG_REUSE=0 node eval/deliver/run.mjs`
- Score: `GG_LEDGER=eval/deliver/ledger.deliver.jsonl node eval/deliver/score.mjs` writes RESULTS.md.
  - It scores the gate (SUBMIT / FIX / HOLD) and the paid judge on its own.
  - A defective result must never be SUBMIT. FIX and HOLD both stop the agent from claiming success.
- Two tasks carry a free local check (`mustInclude`). The scorer counts the defects only that check caught.
