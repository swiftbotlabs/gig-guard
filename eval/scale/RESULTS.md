# Scale run: 129 ship-gate decisions on public contracts with known labels

- 107 real contracts with annotated vulnerabilities from SmartBugs Curated (Apache-2.0) and 22 audited OpenZeppelin v5.1.0 contracts (MIT). The list, sources, commits and hashes are in `eval/scale/manifest.json`; `select.mjs` rebuilds it.
- The dataset's own answer markers (header and `<yes> <report>` lines) were removed before review. Contract names were kept; 31 contracts have a name or comment that hints at the bug, so results are also shown without them.
- Truth is the dataset label. OpenZeppelin files are labelled "audited", not proven bug-free.

Spend $1.88 test USDC on Telegraph testnet. Requests 258, answered and paid 188, failed with no charge 70. Answer latency p50 28.4 s, p95 56.5 s.

**Cost per right gate decision: $0.019** (all spend divided by decisions that matched the label).

| | Caught (vulnerable, flagged) | Missed | False alarm (audited, flagged) | Passed audited | Held: no review bought | Right, of decided |
|---|---|---|---|---|---|---|
| Gate verdict | 91 | 0 | 1 | 8 | 29 | 99% |
| Gate verdict, contracts without name hints | 61 | 0 | 1 | 8 | 28 | 99% |
| Local rules alone (free) | 29 | 78 | 1 | 21 | 0 | 39% |

| Category | Caught | Missed | Held |
|---|---|---|---|
| access_control | 15 | 0 | 1 |
| arithmetic | 14 | 0 | 1 |
| bad_randomness | 4 | 0 | 3 |
| denial_of_service | 5 | 0 | 1 |
| front_running | 3 | 0 | 1 |
| other | 2 | 0 | 1 |
| reentrancy | 30 | 0 | 0 |
| short_addresses | 1 | 0 | 0 |
| time_manipulation | 5 | 0 | 0 |
| unchecked_low_level_calls | 12 | 0 | 8 |

| Intent | Miner | Answers | Spend | Caught | Missed | False alarms | Passed audited | Empty | $ per right answer |
|---|---|---|---|---|---|---|---|---|---|
| SECURITY_REVIEW_GENERAL | 9002 | 96 | $0.96 | 88 | 0 | 0 | 8 | 0 | $0.010 |
| CODE_REVIEW_GENERAL | 7310045 | 92 | $0.92 | 81 | 3 | 1 | 7 | 0 | $0.011 |

Failed requests (not charged):

- 27 × SECURITY_REVIEW_GENERAL: HTTP 200
- 25 × CODE_REVIEW_GENERAL: HTTP 200
- 6 × SECURITY_REVIEW_GENERAL: fetch failed
- 5 × CODE_REVIEW_GENERAL: fetch failed
- 7 × CODE_REVIEW_GENERAL: HTTP 500 upstream call failed: context deadline exceeded

Every paid answer has its receipt in `eval/scale/ledger.public.jsonl`; `node src/cli.mjs verify` checks them against the testnet node.
