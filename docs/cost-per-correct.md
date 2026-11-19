# Cost per verified correct answer

Each paid answer is graded by a check that does not trust the miner: a free public-RPC read for balances, deterministic local rules for Solidity reviews. Answers with no such check are 'unknown', never counted as correct.

Paid answers: 12 ($0.12). Correct 5, incorrect 0, empty 1, unconfirmed 0, unknown 6.
Cost per verified correct answer: $0.024 over all spend, $0.012 over checkable spend only.

| Intent | Miner | Paid | Spend | Correct | Incorrect | Empty | Unconfirmed | Unknown | $ per verified correct |
|---|---|---|---|---|---|---|---|---|---|
| SECURITY_REVIEW_GENERAL | 731001 | 2 | $0.02 | 2 | 0 | 0 | 0 | 0 | $0.010 |
| CODE_REVIEW_GENERAL | 20260828 | 2 | $0.02 | 2 | 0 | 0 | 0 | 0 | $0.010 |
| WALLET_BALANCE_CHECK_GENERAL | 20260828 | 3 | $0.03 | 1 | 0 | 0 | 0 | 2 | $0.030 |
| WEB_SEARCH_GENERAL | 303 | 2 | $0.02 | 0 | 0 | 0 | 0 | 2 | n/a |
| URL_SCAN_VERDICT | 731006 | 1 | $0.01 | 0 | 0 | 0 | 0 | 1 | n/a |
| URL_SAFE_GENERAL | 20260828 | 1 | $0.01 | 0 | 0 | 0 | 0 | 1 | n/a |
| WALLET_BALANCE_CHECK_GENERAL | ? | 1 | $0.01 | 0 | 0 | 1 | 0 | 0 | n/a |

Wrong and empty answers, with the reason:

- WALLET_BALANCE_CHECK_GENERAL (miner ?, claim gate): empty, empty answer
