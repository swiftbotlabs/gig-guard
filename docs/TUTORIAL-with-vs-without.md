# Add paid answers to your agent's decision step, then measure if they were worth it

*A practical tutorial on Telegraph testnet. It takes about 20 minutes and costs no real money.*

Most agents already have a moment where they decide something: take this job, ship this file, send this reminder. This tutorial shows how to put paid Telegraph answers into that moment without letting them take over. It then shows how to check, from your own logs, whether they changed anything.

We did this in Gig Guard, an open-source safety gate for a freelance agent. Our honest result from a real testnet run: **the paid answers changed 2 of 10 decisions, for $0.12 in total** ($0.06 per changed decision). The other 8 came out the same, but with a receipt behind them. The method below is how we got that number, and you can get yours the same way.

---

## The pattern in one picture

```
input ──► free checks ──► paid answers (capped) ──► written policy ──► verdict + reasons ──► log
                │                   │                                         │
                └──── recorded ─────┴──────────── recorded ───────────────────┘
```

Four rules make it work:

1. **Free checks first.** Use whatever your agent can already check for nothing, such as a public RPC read or a local linter. They are the baseline, and they are your "without".
2. **Paid answers are evidence, not verdicts.** The policy reads them. It never copies a miner's verdict straight through.
3. **Hard caps before signing.** Set a limit per call and a limit per day, and check them before any payment is signed.
4. **Log everything a replay needs:** the free evidence, the paid evidence, the receipts, the cost and the policy version.

---

## Step 1. Set up a testnet payer (5 minutes)

Follow steps 1 and 2 of `docs/TUTORIAL.md` in the repo. You need:

- a testnet-only key;
- some Sepolia ETH for gas;
- test USDC, minted and deposited into the Telegraph escrow balance.

Never use a key that has held real funds. Then:

```bash
git clone https://github.com/swiftbotlabs/gig-guard && cd gig-guard && npm install
npm test                      # offline, fake node, no funds needed
cp .env.example .env          # set TELEGRAPH_PAYER_KEY; GG_RAIL=escrow is the default
```

Why escrow? The escrow rail needs one EIP-191 signature per request and no facilitator. During our run, x402 `exact` settlement on the testnet facilitator kept timing out (issue #214), while escrow kept working.

## Step 2. Buy one answer with caps (`src/telegraph.mjs`)

```js
import { ask } from "./src/telegraph.mjs";
const r = await ask("WALLET_BALANCE_CHECK_GENERAL", { address: "0x…", chain: "ethereum", token: "USDT" }, { purpose: "my-gate" });
// r = { result, receipt: { receipt_hash, epoch_id }, cost_usd, miner_id, ms }
```

`ask()` refuses before signing if the quote is above `GG_MAX_PER_CALL` (default $0.03), or if the day's spend would pass `GG_MAX_PER_DAY` (default $1.00). Every call is appended to `ledger.jsonl`, including failures.

## Step 3. Wrap it so bad answers can't slip through (`buy()` in `src/guards.mjs`)

Paid answers fail in quiet ways. These are the ones we hit:

| Failure | What `buy()` does |
|---|---|
| Every field empty or `null` | Marked "empty answer" and moved to the next supplier. The cost still counts. |
| Answer older than the fact you need | Marked "stale", not used as evidence |
| Same question asked again this hour | Reuses the earlier receipt and pays nothing |
| No supplier delivers | Returns `ok: false`. The policy must handle "unknown". |

Give `buy()` a short list of intents to try in order, for example a balance check and then a transfer lookup. The first answer that is actually filled in wins.

## Step 4. Write the policy as a pure function

This is the part most agents skip. Here is our job-lead check, simplified (the real one, `scoutVerdict` in `src/guards.mjs`, also checks link flags, HTTPS and red-flag phrases):

```js
export function scoutVerdict({ url, client }, evidence) {   // simplified; field names differ in the real one
  let verdict = "GO"; const reasons = [];
  const [link, history] = evidence;
  if (!link.ok) { verdict = "CAUTION"; reasons.push("link reputation unavailable"); }
  // Only SOURCES count: an answer that names the client with no source naming it may be made up.
  const named = (history.result?.sources || []).filter((s) => s.toLowerCase().includes(client.toLowerCase()));
  if (!named.length && verdict === "GO") { verdict = "CAUTION"; reasons.push("no source names the client"); }
  return { verdict, reasons };
}
```

Because it is pure, a decision you logged last week can be replayed under today's policy, at no cost. Record `policy: "v6"` on each decision so you can tell versions apart.

## Step 5. Measure: with vs without, from your own ledger

```bash
GG_LEDGER=./ledger.jsonl node src/cli.mjs compare docs/compare.md docs/compare.json
```

For every logged decision, `compare` (in `src/compare.mjs`):

- **Without:** re-runs the same policy using only the free evidence recorded in that decision. For example: local Solidity rules only; a balance from a public RPC read; and for a job lead, nothing, so CAUTION.
- **With:** takes the verdict the agent actually made, with its paid answers.
- **Today:** replays the current policy on the same evidence, so you can see which past verdicts your fixes would overturn.
- **Counts:** each decision's cost, paid answers, reused answers, and every failure or doubt it logged.

Nothing is re-run and nothing is paid. It prints one totals line:

```
{"decisions":10,"changed":2,"cost_usd":0.12,…}
```

## What our numbers said (testnet, 18 Nov)

| | Count |
|---|---|
| Decisions | 10 |
| Changed by paid answers | **2** |
| Same verdict, now with receipts | 8 |
| Total spend | **$0.12** test USDC |
| Per changed decision | **$0.06** |

**Where paid answers mattered.** Both changed decisions were overdue payments on chains the agent can't read for free (payment A, and payment C on BNB Smart Chain): without a paid answer the verdict was PENDING, "no proof either way"; with one it was a sourced CLAIM, for $0.01 each.

**Where they didn't.**
- Job-lead searches mostly returned links that never named the client. The verdict was CAUTION either way.
- Contract reviews: local rules had already caught the sample contract's bugs (FIX either way), and the clean contract was SHIP either way. The paid reviews added an independent second opinion, not a different verdict.
- Payments on chains with a free public read: the paid answer agreed with the chain (CLAIM either way, now with two sources).
- One payment on a chain no miner could read stayed PENDING: the paid lookup came back empty.

**What went wrong, and what we changed:**
- In earlier runs, a policy version said GO on an empty search answer and on an unsourced one. Now a source must name the client (policy v6). In the 10 decisions above no such GO was left, so the replay overturns 0 of them; `compare` shows the column so you can see it on your own ledger.
- One review miner returns `verdict: null` while listing real CWE findings. A gate that reads only the verdict would ship a vulnerable contract. Ours counts the findings.
- Empty paid answers are logged and counted in the cost, never treated as evidence.

**Takeaway.** Paid answers earned their place where the agent had no free signal. Elsewhere they mostly confirmed what it already knew. That is still worth a cent when the action is costly, but it is worth knowing. Run `compare` on your own ledger before you decide where to spend.

## Step 6. Check the receipts (no wallet needed)

```bash
node src/cli.mjs verify
```

`verify` asks the node whether each receipt is in its settled epoch block (`/v1/blocks/{epoch}/deliveries/{hash}`). The public ledger page has the same check as a button in the browser: https://apps.swiftbotlab.workers.dev/gig-guard/ledger

---

## Adapting it to your agent

1. List your decision points, and the free checks you already have for each.
2. For each one, add one or two Telegraph intents that cover what the free checks can't see.
3. Write the verdict as a pure function of the evidence, and log the evidence.
4. After a few days, run `compare`. Keep paying only where the "changed" column isn't empty.

*Gig Guard is a Telegraph Season II hackathon entry, with a prize incentive. Testnet only, no real money. No independent users yet: if you try this, tell us what breaks.*
