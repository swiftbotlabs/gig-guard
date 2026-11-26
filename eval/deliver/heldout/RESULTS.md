# Held-out set: one live run (Telegraph testnet)

- 10 new tasks (a correct and a defective result each), written after the gate changes and never used for tuning. Frozen before the run: sha256 `e05470e5e2e6ac163b2626cab35d45f88f271514b8558d561fbb34559b81bebc` (HELDOUT.sha256, committed first).
- Network: testnet (Ethereum Sepolia escrow, test USDC). Receipts: 10 of 10 SETTLED, 0 pending, 0 mismatched.

```
{
 "cases": 20,
 "ran": 20,
 "bad_submitted": 0,
 "bad_total": 10,
 "good_submitted": 4,
 "good_total": 10,
 "hold": 11,
 "hold_no_answer": 10,
 "cost_usd": 0.1
}
```

| case | truth | gate | planted defect | first reason |
|---|---|---|---|---|
| temp-c/good | done | SUBMIT |  | judge: satisfies (score 10.0) |
| temp-c/bad | not_done | FIX | wrong conversion | judge: Fails (score ?). 22.8 °C |
| even-json/good | done | HOLD |  | no judgement could be bought: fail closed |
| even-json/bad | not_done | HOLD | missing an item | judge: partially_satisfies (score 5.0): not a clear pass; a human decides |
| py-reverse/good | done | SUBMIT |  | judge: satisfies (score 10.0) |
| py-reverse/bad | not_done | FIX | strings have no reverse() | judge: fails (score 0.0). The result uses s.reverse(), which is a list method in Python and does not work on strings sin |
| one-sentence/good | done | SUBMIT |  | judge: satisfies (score 10.0) |
| one-sentence/bad | not_done | FIX | wrong day, reason dropped | judge: fails (score 0.0). The result states the meeting is on Tuesday, but the input text explicitly states it moved 'fr |
| sql-order/good | done | HOLD |  | no judgement could be bought: fail closed |
| sql-order/bad | not_done | HOLD | ordering missing | no judgement could be bought: fail closed |
| fr-invoice/good | done | HOLD |  | no judgement could be bought: fail closed |
| fr-invoice/bad | not_done | FIX | meaning changed | judge: fails (score 0.0). "La facture est payée" translates to "The invoice is paid", failing to accurately translate "T |
| regex-time/good | done | SUBMIT |  | judge: satisfies (score 10.0) |
| regex-time/bad | not_done | HOLD | accepts 99:99 | no judgement could be bought: fail closed |
| js-sum/good | done | HOLD |  | no judgement could be bought: fail closed |
| js-sum/bad | not_done | HOLD | still skips a[0] | no judgement could be bought: fail closed |
| subject-50/good | done | HOLD |  | no judgement could be bought: fail closed |
| subject-50/bad | not_done | HOLD | too long, no specifics | no judgement could be bought: fail closed |
| order-total/good | done | HOLD |  | no judgement could be bought: fail closed |
| order-total/bad | not_done | FIX | wrong total | judge: fails (score 0.0). 3 items at $4.50 = 3*4.50 = $13.50; 2 items at $2.25 = 2*2.25 = $4.50; total = $13.50 + $4.50  |
