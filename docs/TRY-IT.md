# Try Gig Guard in 5 minutes

No wallet, no keys, no funds. You check our receipts against the Telegraph testnet node yourself and recompute our numbers from the public ledger.

Prerequisites: Node.js 20+ and git.

```bash
git clone https://github.com/swiftbotlabs/gig-guard && cd gig-guard
npm install
npm test                                                               # 51 tests against a fake node (a few seconds)
GG_LEDGER=ledger.public.jsonl node src/cli.mjs verify my-verify.json   # asks the Telegraph testnet node about all 12 receipts (~10 s)
GG_LEDGER=ledger.public.jsonl node src/cli.mjs report my-report.md     # re-grades every paid answer and prices it
```

What you should see:

- `npm test`: `# pass 23`, `# fail 0`.
- `verify`: `{"total":12,"settled":12,"pending":0,"mismatch":0,"other":0}`. Each receipt is looked up at
  `GET https://devnode.telegraphprotocol.com/v1/blocks/{epoch}/deliveries/{receipt_hash}`; SETTLED means the epoch block lists that delivery
  with the same payer, intent and amount.
- `report`: `my-report.md` is identical to [`cost-per-correct.md`](cost-per-correct.md) (12 paid answers, 5 verified correct, $0.024 per
  verified correct answer). `diff my-report.md docs/cost-per-correct.md` prints nothing.

The same receipt check runs in the browser: open the [ledger page](https://apps.swiftbotlab.workers.dev/gig-guard/ledger) and press
**Check receipts live**.

## 15 more minutes: make your own purchase (testnet)

Follow [TUTORIAL.md](TUTORIAL.md) step 2 to put test USDC in a Telegraph escrow balance on Ethereum Sepolia, then run one gate, for example
`node src/cli.mjs ship samples/Vault.sol` (expect FIX, $0.02, about a minute) and `node src/cli.mjs verify` a few hours later, once the epoch
block is recorded. Use a fresh testnet-only key.

## Tell us what happened

Open an issue with the **Tried it** template: what you ran, what you got, what broke or was unclear. Failures are the most useful reports.
There is no reward for trying it; we only want honest results.
