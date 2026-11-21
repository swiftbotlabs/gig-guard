# Planted-bug run: 12 Solidity samples, ground truth known

8 samples with one planted bug each (SWC-104/105/106/107/112/115/120/121) and 4 written clean (`eval/truth.json`). Each went through the ship gate once on Telegraph testnet: one SECURITY_REVIEW_GENERAL and one CODE_REVIEW_GENERAL answer, bought by the agent. A review is correct when it flags a buggy sample or passes a clean one. The truth is the planted label, not a miner and not our local rules.

Spend $0.11 test USDC. Answer latency p50 29.4 s, p95 38.3 s (11 answers).

Requests sent: 24; answered and paid: 11; failed with no charge: 13.

- 9 × SECURITY_REVIEW_GENERAL: HTTP 500 upstream call failed: context deadline exceeded
- 2 × CODE_REVIEW_GENERAL: fetch failed
- 1 × CODE_REVIEW_GENERAL: HTTP 500 upstream call failed: context deadline exceeded
- 1 × SECURITY_REVIEW_GENERAL: fetch failed

| | Caught (of 8 bugs) | Missed | False alarms (of 4 clean) | Held: no review could be bought | Correct, of decided |
|---|---|---|---|---|---|
| Gate verdict as recorded on 2026-11-20 (FIX = flagged) | 5 | 1 | 2 | 3 | 67% |
| Same answers, re-decided by the current code (fixed parser, no new purchase) | 6 | 0 | 2 | 3 | 78% |
| Local rules alone (free) | 5 | 3 | 0 | 0 | 75% |

| Intent | Miner | Answers | Spend | Caught | Missed | False alarms | Passed clean | Empty | $ per correct answer |
|---|---|---|---|---|---|---|---|---|---|
| CODE_REVIEW_GENERAL | 7310045 | 9 | $0.09 | 6 | 0 | 2 | 1 | 0 | $0.013 |
| SECURITY_REVIEW_GENERAL | 719190 | 2 | $0.02 | 0 | 0 | 0 | 2 | 0 | $0.010 |

Per sample:

- B01_Reentrancy.sol (bug): gate FIX; CODE_REVIEW_GENERAL miner 7310045: flagged (TP)
- B02_TxOrigin.sol (bug): gate FIX; CODE_REVIEW_GENERAL miner 7310045: flagged (TP)
- B03_Selfdestruct.sol (bug): gate FIX; CODE_REVIEW_GENERAL miner 7310045: flagged (TP)
- B04_Delegatecall.sol (bug): gate FIX; CODE_REVIEW_GENERAL miner 7310045: flagged (TP)
- B05_UncheckedCall.sol (bug): gate FIX; CODE_REVIEW_GENERAL miner 7310045: flagged (TP)
- B06_WeakRandom.sol (bug): gate HOLD; 
- B07_MissingAccessControl.sol (bug): gate SHIP (current code: FIX); CODE_REVIEW_GENERAL miner 7310045: flagged (TP)
- B08_SignatureReplay.sol (bug): gate HOLD; 
- C01_SafeTipJar.sol (clean): gate FIX; SECURITY_REVIEW_GENERAL miner 719190: passed (TN); CODE_REVIEW_GENERAL miner 7310045: flagged (FP)
- C02_OwnedVault.sol (clean): gate HOLD; 
- C03_Escrow.sol (clean): gate FIX; CODE_REVIEW_GENERAL miner 7310045: flagged (FP)
- C04_Counter.sol (clean): gate SHIP; SECURITY_REVIEW_GENERAL miner 719190: passed (TN); CODE_REVIEW_GENERAL miner 7310045: passed (TN)

Limits: 12 short samples written by us, one pass each, so a rerun can differ. Every answer's receipt is in `eval/ledger.public.jsonl`.
The review parser was fixed (2026-11-21) after reading these 11 answers: three code reviews that named the bug (B02 "not secure", B05 "unchecked low-level call", B07 "not correct ... can permanently lose funds") had been read as passes, and one security review that said "no security vulnerabilities were found" had been read as a flag because it listed advisory IDs. The re-decided row is therefore in-sample; a fresh run with the frozen parser is the out-of-sample check.
