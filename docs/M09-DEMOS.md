# Mission 09: the tests worth demonstrating

Mission 09 asks entrants to show a stale local answer, no budget, a failed payment and a conflicting provider answer, and to require explicit permission for external effects. `node examples/m09-demos.mjs` runs all five against a fake Telegraph node and a fake RPC (no network, no funds). The gates, policy, ledger and escrow client are the real code; only the node and the chain are fakes. Output of 2026-11-23:

```
## 1. Stale local answer: not reused, bought fresh, then checked against the chain
- ledger holds a 25-minute-old balance answer for this wallet (reuse TTL for balances: 10 min)
- paid requests sent: 1 (fresh answer, receipt 0xdemo0001)
- decision: CLAIM; wallet holds 0 USDT on ethereum as of 2026-11-23T16:40:20.714Z: payment of $400 not received; uncertainty: miner answer 400 disagrees with the chain (0): using the chain value

## 2. Conflicting provider answer (same run)
- miner: 400 USDT; free chain read: 0 USDT; the chain value is used and the conflict is listed as uncertainty
- letter drafted: yes; action: awaiting user approval

## 2b. Conflicting answers on a deliverable: the paid judge passes it, the client's required item is missing
- decision: FIX; judge: satisfies (score 9.0) | missing from the result: total; uncertainty: the judge passed it, but a required item is missing

## 3. Permission for external effects
- no answer from the user: action "awaiting user approval"
- user said no: action "declined by user: not sent", letter kept: no
- Gig Guard itself never sends anything; only an approved letter is handed to the mailer.

## 4. Failed payment (escrow exhausted)
- node: 402 escrow balance exhausted: insufficient escrow for delivery: unbilled=40000 μUSDC + price=10000 μUSDC > balance=45000 μUSDC
- error type: EscrowFundsError; shortfall 5000 μUSDC
- paid requests tried: 1 (no fallback purchase); decisions logged: 0 (no false HOLD); an eval run stops here with exit code 3

## 5. No budget (daily cap $0.10 in this demo; default $1.00)
- BudgetError: daily cap 100000 uUSDC reached
- requests that reached the node: 0
```

Checks behind it: with the stored balance answer 2 minutes old instead of 25, demo 1 reuses it and sends 0 requests (the TTL is what decides). The live counterparts are on testnet: the stale-answer and chain-disagreement rules on the public ledger (claim gate, 18 Nov), the escrow 402 in eval/deliver/run-1.log and run-2.log (22 Nov), and the per-call and per-day caps in every run. Tests: test/policy.test.mjs and test/escrow.test.mjs.
