# Deliver gate: rerun variance (3 runs of the same 40 cases, Telegraph testnet)

> Scope: this is our own 40-case set. On an outside set we did not write (LLMBar), the judge was too lenient: see [outsider/RESULTS.md](outsider/RESULTS.md).

| run | decided | defective submitted (of 20) | correct submitted (of 20) | HOLD (no Miner answer / unclear verdict) | cost (test USDC) | median answer s |
|---|---|---|---|---|---|---|
| ledger.deliver.jsonl | 40 | 0 | 18 | 2 (0 / 2) | $0.38 | 13.2 |
| rerun-1.jsonl | 40 | 0 | 14 | 9 (6 / 3) | $0.34 | 10.1 |
| rerun-2.jsonl | 40 | 0 | 17 | 9 (5 / 4) | $0.35 | 9 |

**The safety result held in every run: no defective result was submitted in any of the 3 runs.** The cost of failing closed is more HOLDs when Miner supply is thin. In the reruns, 11 of 18 HOLDs were "no judgement could be bought": no Miner answer reached us (mostly "fetch failed" after the request was signed; we count those as possibly charged, issue #228; the cost column counts paid answers only), and nothing was claimed as done. Of the 13 cases whose verdict changed, 10 changed because a Miner answer was missing in some run, and 3 are real judge flips.

- Defective results submitted per run: 0 (range 0-0).
- Correct results submitted per run: 16.3 (range 14-18).
- HOLD per run: 6.7 (range 2-9).
- Same verdict in every run: 27 of 40 cases.

Cases whose verdict changed between runs:

- json-keys/bad (planted defect): FIX / HOLD / HOLD (judge changed its verdict)
- translate-es/good (correct result): SUBMIT / HOLD / SUBMIT (no Miner answer in a run)
- sql-count/good (correct result): SUBMIT / HOLD / SUBMIT (no Miner answer in a run)
- regex-zip/good (correct result): SUBMIT / HOLD / SUBMIT (no Miner answer in a run)
- regex-zip/bad (planted defect): FIX / HOLD / HOLD (no Miner answer in a run)
- dates-iso/good (correct result): SUBMIT / SUBMIT / HOLD (no Miner answer in a run)
- dates-iso/bad (planted defect): FIX / FIX / HOLD (no Miner answer in a run)
- sort-list/good (correct result): SUBMIT / HOLD / SUBMIT (no Miner answer in a run)
- api-status/good (correct result): SUBMIT / HOLD / SUBMIT (no Miner answer in a run)
- csv-dedupe/good (correct result): FIX / SUBMIT / SUBMIT (judge changed its verdict)
- csv-dedupe/bad (planted defect): FIX / FIX / HOLD (no Miner answer in a run)
- percent/good (correct result): SUBMIT / SUBMIT / HOLD (no Miner answer in a run)
- percent/bad (planted defect): FIX / FIX / HOLD (judge changed its verdict)
