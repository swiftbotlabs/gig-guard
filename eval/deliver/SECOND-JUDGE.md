# Second opinion: live run on the hardest cases (Telegraph testnet)

The gate with `GG_SECOND_JUDGE=1` works like this. When the first judge says "fails" or is unclear, and the free check passed, it asks other Miners by id and decides by majority; with no majority it holds. Below, each case's first-run verdict sits next to the verdict with the second opinion.

| case | truth | first run | with second opinion | expected | right | panel |
|---|---|---|---|---|---|---|
| json-keys/bad | not_done | FIX | HOLD | FIX or HOLD | yes | judge panel (2 Miners): fail, unclear: no majority; HOLD |
| bug-fix/good | done | HOLD | SUBMIT | SUBMIT | yes | no panel (first judge passed or no answer) |
| csv-dedupe/good | done | FIX | HOLD | SUBMIT | NO | judge panel (2 Miners): fail, pass: no majority; HOLD |
| percent/bad | not_done | FIX | FIX | FIX or HOLD | yes | judge panel (2 Miners): fail, fail: majority fails |
| css-center/bad | not_done | HOLD | HOLD | FIX or HOLD | yes | judge panel (3 Miners): unclear, fail, unclear: no majority; HOLD |

Spend: $0.10 test USDC.
