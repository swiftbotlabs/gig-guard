# Mainnet readiness: where Gig Guard stands (checked 2026-11-23 22:26 UTC)

Tracking issue: [#1 Mainnet: blocked on a Telegraph mainnet payment route](https://github.com/swiftbotlabs/gig-guard/issues/1).

Gig Guard runs on Telegraph **testnet only**. Nothing has been spent on mainnet. This page lists what blocks mainnet, what we control and what we don't, and the exact change once the blocker is gone.

## The blocker: no mainnet payment route on the node we use
- An unpaid request to `https://devnode.telegraphprotocol.com/engine/v1/ask` on 2026-11-23 22:26 UTC returned 402 with three payment options, all on testnets ([`node-402-2026-11-23.json`](node-402-2026-11-23.json)):
  - x402 `exact` on Base Sepolia (`eip155:84532`);
  - x402 `exact` on Solana devnet;
  - escrow on Ethereum Sepolia (`eip155:11155111`).
- The same three options were offered on 2026-11-20 ([`node-402-2026-11-20.json`](node-402-2026-11-20.json)).
- Until Telegraph offers a mainnet route, a mainnet purchase is not possible from this client.
- We will re-check this file's request when Telegraph announces mainnet routes.

## What changes once a route exists (configuration, not a rewrite)
1. `TELEGRAPH_NODE`: the mainnet node URL.
2. `TELEGRAPH_NETWORK` and `config.assets`: the mainnet USDC address. `config.explorers`: its explorer.
3. The escrow rail's pinned values in [`src/escrowmsg.mjs`](../src/escrowmsg.mjs) (the Diamond address and the network). They are pinned on purpose, so the client signs only the known payment message for the known payee. On mainnet they become the mainnet Diamond and chain, set from config and reviewed once.
4. Fund a **dedicated low-balance key**, never a treasury key. The hard caps stay:
   - `GG_MAX_PER_CALL` $0.03;
   - `GG_MAX_PER_DAY` $1.00;
   - signed failures are counted (issue #228);
   - a run stops on an exhausted escrow.

   For the hosted check, the throwaway payer's deposit is the absolute cap.

The gates, policy, ledger and receipt check do not change. The deliver gate's measured cost is about $0.01 per decision; at that price, 100 checks a day cost about $1.

## Exact steps, once a mainnet route exists
1. **Confirm the route.** Repeat the unpaid probe; it signs nothing and spends nothing:
   ```bash
   curl -s -D - -X POST -H 'content-type: application/json' \
     -d '{"intent":"TASK_EXECUTION_QUALITY_GENERAL","params":{"task":"x","result":"y"},"max_budget_usdc":10000}' \
     https://<mainnet-node>/engine/v1/ask | grep -i payment-required
   ```
   The decoded `accepts` list must contain a mainnet network (for example `eip155:8453` or `eip155:1`). Save it as `docs/node-402-<date>.json`.
2. **Configure.** In `.env`, set `TELEGRAPH_NODE=<mainnet-node>` and `TELEGRAPH_NETWORK=<CAIP-2 id>`. In `src/config.mjs`, add the mainnet USDC address to `config.assets` and the explorer to `config.explorers`.
3. **Pin the payee.** In `src/escrowmsg.mjs`, set `DIAMOND` and `ESCROW_NETWORK` to the mainnet Diamond and chain. Take both from the node's own challenge and Telegraph's docs, and check that the contract exists on chain. Have a second person review this change: it decides what the client will sign.
4. **Key.** Generate a new key used only for this:
   ```bash
   node -e 'const {generatePrivateKey,privateKeyToAccount}=require("viem/accounts");const k=generatePrivateKey();console.log(k, privateKeyToAccount(k).address)'
   ```
   Keep it in a secret store, never in the repo. Deposit at most a few dollars of USDC: the deposit is the absolute cap.
5. **Caps.** Set `GG_MAX_PER_CALL=10000` ($0.01, the judge's price) and `GG_MAX_PER_DAY=1000000` ($1). Signed failures count toward the cap (issue #228).
6. **Smoke test.** Run one done-check on a known-answer case:
   ```bash
   node src/cli.mjs deliver '{"task":"Write a one-line JavaScript expression that is true when the string s has at least 12 characters.","result":"s.length > 12"}'
   ```
   Expect FIX. Then check its receipt with `node src/cli.mjs verify`. Only after that, run the 40-case set (`eval/deliver/run.mjs`) and compare with the testnet numbers.
7. **Hosted check.** Use a separate payer and its own deposit, set its own `DAY_CAP_UUSDC`, then redeploy `hosted/`.

## Already on mainnet data
The claim gate's free cross-check reads real balances from public mainnet RPCs on six chains.

## Still missing for production (honest list)
- **Outside users.** None yet. A public call to try the hosted check is planned.
- **A second judge** for the cases where one judge contradicts itself. Today those are held for a human.
- **Variance.** Each known-answer case ran once; repeat runs would show how stable the judge is.
