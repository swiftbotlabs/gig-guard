# Fix loop, live on Telegraph testnet (2026-11-23 19:32 UTC)

Run with `node examples/fix-loop.mjs`.

```
task: Export these invoices to CSV with columns invoice,amount and a final row 'total' with the sum: INV-1 120.00, INV-2 80.50, INV-3 19.50.

attempt 1 (as delivered):
invoice,amount
INV-1,120.00
INV-2,80.50
INV-3,19.50
total,210.00
check 1: FIX  $0.01  receipt 0x69af6cd3536b3bcef95886e6d021dc853d7e42a34763669fca3f926e47aea298  | judge: fails (score ?). the total row shows 210.00 instead of the correct sum of 220.00

attempt 2 (redone after FIX):
invoice,amount
INV-1,120.00
INV-2,80.50
INV-3,19.50
total,220.00
check 2: SUBMIT  $0.01  receipt 0xb6b732cecb74efa71713d9a8f2ffcec1a48369f0fa217d1874a71f683b551782  | judge: satisfies (score ?)

SUBMIT after one redo; total $0.02
exit=0
```
