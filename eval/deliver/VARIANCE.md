# Deliver gate: rerun variance (3 runs of the same 40 cases, Telegraph testnet)

| run | decided | defective submitted (of 20) | correct submitted (of 20) | HOLD | cost (test USDC) | median answer s |
|---|---|---|---|---|---|---|
| ledger.deliver.jsonl | 40 | 0 | 18 | 2 | $0.38 | 13.2 |
| rerun-1.jsonl | 40 | 0 | 14 | 9 | $0.34 | 10.1 |
| rerun-2.jsonl | 40 | 0 | 17 | 9 | $0.35 | 9 |

- Defective results submitted per run: 0 (range 0-0).
- Correct results submitted per run: 16.3 (range 14-18).
- HOLD per run: 6.7 (range 2-9).
- Same verdict in every run: 27 of 40 cases.

Cases whose verdict changed between runs:

- json-keys/bad (planted defect): FIX / HOLD / HOLD
- translate-es/good (correct result): SUBMIT / HOLD / SUBMIT
- sql-count/good (correct result): SUBMIT / HOLD / SUBMIT
- regex-zip/good (correct result): SUBMIT / HOLD / SUBMIT
- regex-zip/bad (planted defect): FIX / HOLD / HOLD
- dates-iso/good (correct result): SUBMIT / SUBMIT / HOLD
- dates-iso/bad (planted defect): FIX / FIX / HOLD
- sort-list/good (correct result): SUBMIT / HOLD / SUBMIT
- api-status/good (correct result): SUBMIT / HOLD / SUBMIT
- csv-dedupe/good (correct result): FIX / SUBMIT / SUBMIT
- csv-dedupe/bad (planted defect): FIX / FIX / HOLD
- percent/good (correct result): SUBMIT / SUBMIT / HOLD
- percent/bad (planted defect): FIX / FIX / HOLD
