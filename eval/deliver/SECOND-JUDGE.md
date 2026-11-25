# Second opinion: live run on the hardest cases (Telegraph testnet)

The gate with `GG_SECOND_JUDGE=1` works like this. When the first judge says "fails" or is unclear, and the free check passed, it asks other Miners by id and decides by majority; with no majority it holds. Below, each case's first-run verdict sits next to the verdict with the second opinion.

| case | truth | first run | with second opinion | expected | right | panel |
|---|---|---|---|---|---|---|

Spend: $0.01 test USDC.
