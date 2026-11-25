# Gig Guard: evidence for every headline number

Testnet only: Telegraph devnode, Ethereum Sepolia escrow, test USDC. No real money. Each file below is pinned to commit 9d5499c. The evidence files have not changed since that commit.

## Files
| What | File (pinned) |
|---|---|
| Done-check results, the misses, the per-receipt table | [eval/deliver/RESULTS.md](https://github.com/swiftbotlabs/gig-guard/blob/9d5499c81d9d1ead45e34f8749036f26d561b54f/eval/deliver/RESULTS.md) |
| Done-check cases (truth by construction) | [eval/deliver/cases.json](https://github.com/swiftbotlabs/gig-guard/blob/9d5499c81d9d1ead45e34f8749036f26d561b54f/eval/deliver/cases.json) |
| Done-check paid answers and decisions (redacted) | [eval/deliver/ledger.public.jsonl](https://github.com/swiftbotlabs/gig-guard/blob/9d5499c81d9d1ead45e34f8749036f26d561b54f/eval/deliver/ledger.public.jsonl) |
| Done-check receipt check (38/38) | [eval/deliver/receipts-verify.json](https://github.com/swiftbotlabs/gig-guard/blob/9d5499c81d9d1ead45e34f8749036f26d561b54f/eval/deliver/receipts-verify.json) |
| Contract gate, 129 contracts: results and policy-v7 note | [eval/scale/RESULTS.md](https://github.com/swiftbotlabs/gig-guard/blob/9d5499c81d9d1ead45e34f8749036f26d561b54f/eval/scale/RESULTS.md), [results.json](https://github.com/swiftbotlabs/gig-guard/blob/9d5499c81d9d1ead45e34f8749036f26d561b54f/eval/scale/results.json) |
| Contract gate receipt check (201/202) | [eval/scale/receipts-verify.json](https://github.com/swiftbotlabs/gig-guard/blob/9d5499c81d9d1ead45e34f8749036f26d561b54f/eval/scale/receipts-verify.json) |
| Planted-bug run (12 contracts) and the B07 note | [eval/RESULTS.md](https://github.com/swiftbotlabs/gig-guard/blob/9d5499c81d9d1ead45e34f8749036f26d561b54f/eval/RESULTS.md), [eval/ledger.public.jsonl](https://github.com/swiftbotlabs/gig-guard/blob/9d5499c81d9d1ead45e34f8749036f26d561b54f/eval/ledger.public.jsonl) |
| Audited-v7 fresh run (22 contracts) | [eval/scale/RESULTS-audited-v7.md](https://github.com/swiftbotlabs/gig-guard/blob/9d5499c81d9d1ead45e34f8749036f26d561b54f/eval/scale/RESULTS-audited-v7.md) |
| Live fix loop (FIX, redo, SUBMIT) | [docs/FIX-LOOP.md](https://github.com/swiftbotlabs/gig-guard/blob/9d5499c81d9d1ead45e34f8749036f26d561b54f/docs/FIX-LOOP.md) |
| Mission 09 failure tests | [docs/M09-DEMOS.md](https://github.com/swiftbotlabs/gig-guard/blob/9d5499c81d9d1ead45e34f8749036f26d561b54f/docs/M09-DEMOS.md) |
| Mainnet blocker and switch steps | [docs/MAINNET.md](https://github.com/swiftbotlabs/gig-guard/blob/9d5499c81d9d1ead45e34f8749036f26d561b54f/docs/MAINNET.md) |
| Gate-to-mission map (M09 deliver, M14 ship) | [docs/MISSIONS.md](MISSIONS.md) |
| M14 Route 3 simulated reward logic on the 129 contracts | [eval/scale/REWARDS.md](../eval/scale/REWARDS.md), [rewards.json](../eval/scale/rewards.json) |
| Held-out set (frozen before run) and outsider LLMBar set | [eval/deliver/heldout/RESULTS.md](../eval/deliver/heldout/RESULTS.md), [eval/deliver/outsider/](../eval/deliver/outsider/) |
| Buyer, price, unit economics, status | [docs/COMMERCIAL.md](COMMERCIAL.md) |
| Tests: policy (incl. v7 "no SHIP without a security answer"), escrow, #228, hosted check | [test/](https://github.com/swiftbotlabs/gig-guard/tree/9d5499c81d9d1ead45e34f8749036f26d561b54f/test) |

## Reproduce every headline number (files pinned to commit 9d5499c)
Every command reads the files exactly as they were at commit 9d5499c. You need bash, curl and jq. First run:
```
R=https://raw.githubusercontent.com/swiftbotlabs/gig-guard/9d5499c81d9d1ead45e34f8749036f26d561b54f
```
- **Our own 40-case set: 0/20 defective results submitted, 18/20 good ones submitted.** (On an outside set we did not write, the judge was too lenient: 3 to 4 of 10 weaker outputs submitted per run (runs 1-2), [eval/deliver/outsider/RESULTS.md](../eval/deliver/outsider/RESULTS.md).) It prints `{"bad_submitted":0,"good_submitted":18}`.
```
jq -n --slurpfile c <(curl -s $R/eval/deliver/cases.json) --slurpfile l <(curl -s $R/eval/deliver/ledger.public.jsonl) -c '($l|map(select(.kind=="decision"))|map({key:.input.name,value:.verdict})|from_entries) as $v | $c[0].cases | {bad_submitted: map(select(.truth=="not_done" and $v[.id]=="SUBMIT"))|length, good_submitted: map(select(.truth=="done" and $v[.id]=="SUBMIT"))|length}'
```
- **who stopped the 20 defects: judge 17, free check 2, held 1.** It prints `{"judge":17,"free_check":2,"held":1}`.
```
jq -n --slurpfile c <(curl -s $R/eval/deliver/cases.json) --slurpfile l <(curl -s $R/eval/deliver/ledger.public.jsonl) -c '($l|map(select(.kind=="decision"))|map({key:.input.name,value:.})|from_entries) as $d | $c[0].cases|map(select(.truth=="not_done"))|map($d[.id]) | {judge: map(select(.reasons[0]|test("^judge: fails")))|length, free_check: map(select((.reasons[0]|test("^judge: fails")|not) and (.local_missing|length>0)))|length, held: map(select(.verdict=="HOLD"))|length}'
```
- **38/38 done-check receipts settled.** It prints `{"settled":38,"total":38,"mismatch":0}`.
```
curl -s $R/eval/deliver/receipts-verify.json | jq -c '{settled,total,mismatch}'
```
- **129 contracts: 92 caught, 0 missed, 7 false alarms, 8 passed, 22 held.** It prints `{"tp":92,"fn":0,"fp":7,"tn":8,"held":22}`.
```
curl -s $R/eval/scale/results.json | jq -c .gate
```
- **201/202 contract-gate receipts settled.** It prints `{"settled":201,"total":202,"mismatch":0}`.
```
curl -s $R/eval/scale/receipts-verify.json | jq -c '{settled,total,mismatch}'
```
- **12 planted and 22 audited-v7 decisions.** It prints `12, then 22`.
```
for f in eval/ledger.public.jsonl eval/scale/ledger.audited-v7.public.jsonl; do curl -s $R/$f | jq -s '[.[]|select(.kind=="decision")]|length'; done
```
- **41 receipt joins (11 + 30), all settled.** It prints `{"settled":11,"total":11}, then {"settled":30,"total":30}`.
```
for f in eval/receipts-verify.json eval/scale/receipts-verify-audited-v7.json; do curl -s $R/$f | jq -c '{settled,total}'; done
```


## Gaps we found in the network while building
- The escrow rail reserves the whole `max_budget_usdc` until the next epoch block.
- The review Intents take at most 2,000 characters.
- The x402 facilitator has no EVM testnet signer, so we pay from escrow.
- `max_budget_usdc` is rejected on Base Sepolia x402.
- Two Intents have no response schema.
- `WEB_SEARCH_GENERAL` returns null answers for question-style queries.
- Balances on BNB Smart Chain must be asked by token contract.
- The deliveries Merkle leaf encoding is undocumented.

Details for each are in the README ("Gaps found while building").
