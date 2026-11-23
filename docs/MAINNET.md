# Mainnet readiness: where Gig Guard stands (checked 2026-11-23 22:26 UTC)

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

## Already on mainnet data
The claim gate's free cross-check reads real balances from public mainnet RPCs on six chains.

## Still missing for production (honest list)
- **Outside users.** None yet. A public call to try the hosted check is planned.
- **A second judge** for the cases where one judge contradicts itself. Today those are held for a human.
- **Variance.** Each known-answer case ran once; repeat runs would show how stable the judge is.
