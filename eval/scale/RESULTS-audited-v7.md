# Scale run: 22 ship-gate decisions on public contracts with known labels

- 107 real contracts with annotated vulnerabilities from SmartBugs Curated (Apache-2.0) and 22 audited OpenZeppelin v5.1.0 contracts (MIT). The list, sources, commits and hashes are in `eval/scale/manifest.json`; `select.mjs` rebuilds it.
- The dataset's own answer markers (header and `<yes> <report>` lines) were removed before review. Contract names were kept; 31 contracts have a name or comment that hints at the bug, so results are also shown without them.
- Truth is the dataset label. OpenZeppelin files are labelled "audited", not proven bug-free.

Spend $0.30 test USDC on Telegraph testnet. Requests 30, answered and paid 30, failed with no charge 0. Answer latency p50 26.3 s, p95 49.6 s.

**Cost per right gate decision: $0.030** (all spend divided by decisions that matched the label).

| | Caught (vulnerable, flagged) | Missed | False alarm (audited, flagged) | Passed audited | Held: no review could be bought (availability, not accuracy) | Right, of decided |
|---|---|---|---|---|---|---|
| Gate verdict | 0 | 0 | 5 | 10 | 7 | 67% |
| Gate verdict, contracts without name hints | 0 | 0 | 5 | 10 | 7 | 67% |
| Local rules alone (free) | 0 | 0 | 1 | 21 | 0 | 95% |

| Category | Caught | Missed | Held |
|---|---|---|---|

| Intent | Miner | Answers | Spend | Caught | Missed | False alarms | Passed audited | Empty | $ per right answer |
|---|---|---|---|---|---|---|---|---|---|
| SECURITY_REVIEW_GENERAL | 9002 | 15 | $0.15 | 0 | 0 | 5 | 10 | 0 | $0.015 |
| CODE_REVIEW_GENERAL | 9002 | 14 | $0.14 | 0 | 0 | 1 | 13 | 0 | $0.011 |
| CODE_REVIEW_GENERAL | 20260828 | 1 | $0.01 | 0 | 0 | 0 | 1 | 0 | $0.010 |

Failed requests (not charged):


Every paid answer has its receipt in `eval/scale/ledger.public.jsonl`; `node src/cli.mjs verify` checks them against the testnet node.
