# Which gate answers which mission

Two gates, two missions, kept apart: each has its own inputs, its own paid Intents, its own evaluation and its own failure case.
Testnet only (Ethereum Sepolia escrow, test USDC).

| | Mission 09: Personal Agent | Mission 14: Web3 Native & DeFi, Route 3 (responsible vulnerability triage) |
|---|---|---|
| Customer | A developer whose agent does paid work for people and must not report "done" on a wrong result | A bounty program or security team triaging reports on test contracts |
| Gate | `deliver` (done-check): task + the agent's actual result | `ship`: a Solidity contract before it is accepted or shipped |
| Paid Intents | TASK_EXECUTION_QUALITY_GENERAL (fallback LLM_OUTPUT_EVALUATION_GENERAL) | SECURITY_REVIEW_GENERAL + CODE_REVIEW_GENERAL |
| Free local check | required items in the result (`mustInclude`) | deterministic SWC rules (selfdestruct, delegatecall, tx.origin, unchecked call, weak randomness) |
| Decision | SUBMIT / FIX / HOLD | SHIP / FIX / HOLD, then simulated reward (below) |
| Known-answer set | 40 cases (20 correct, 20 defective) | 129 contracts (107 SmartBugs vulnerable, 22 OpenZeppelin audited) + 12 planted |
| New-input tests | held-out set of 20 written after the gate froze (sha256 committed first); outsider set of 20 from LLMBar, authored and labelled by others (eval/deliver/outsider) | 22 audited contracts run fresh on policy v7 (eval/scale/RESULTS-audited-v7.md) |
| Headline | our 40-case set: 0/20 defective submitted, 18/20 correct submitted; 3 runs: 0 defective submitted in any run. Outside LLMBar set, run 1: 3/10 weaker outputs submitted (too lenient) | 92 caught, 0 missed, 7 false alarms, 8 passed, 22 held |
| Cost and time | $0.009 per decision, median 13.2 s | $0.020 per right decision |
| Receipts | 38/38 settled | 201/202 settled |
| Failure case shown | no Miner answer, so HOLD (never SUBMIT); a self-contradicting 'fails' gives FIX on a correct result (csv-dedupe); budget or escrow empty, so the run stops (exit 3) | a contract over the Intents' 2,000-character limit gets HOLD at $0, never SHIP; Miner says Secure but a local rule fires, so FIX |
| Mission test list | stale answer, no budget, failed payment, conflicting answers, consent (docs/M09-DEMOS.md) | "conflicting audit results" (Miner vs local rules; a null verdict with findings gives FIX) and "malicious contract fixture" (the planted set) |

## Mission 14, Route 3: triage and simulated reward logic

The mission asks to "purchase security evidence and demonstrate triage and simulated reward logic".
`src/reward.mjs` treats each contract review as a bug report to a test bounty program. It decides what the program would pay. No money moves.

Rules:
- A reward is auto-approved only on FIX with a finding that a deterministic local rule confirms.
- A Miner-only finding waits for human reproduction and pays $0 until then.
- SHIP closes the report. HOLD goes to a human.
- Severity comes from the confirmed SWC id, never from the Miner's own rating.
- One reward per (contract, SWC id). The program pool caps the total.

On the 129-contract run (`eval/scale/REWARDS.md`; reproduce with `GG_LEDGER=… node eval/scale/reward.mjs`):
- 23 rewards were auto-approved, all 23 on contracts labelled vulnerable, so there were 0 wrongful payouts.
- 76 reports are pending reproduction and 22 went to a human.
- 8 reports were closed, none of them on a vulnerable contract.
- $7,600 was paid in simulation, out of a $10,000 pool.
- Each reward cites the paid receipts it was based on.

What it does not do: real payouts, and the reproduction step itself (a human or a fuzzer).
Routes 1 and 2 (token preflight, conditional escrow) are not built.
