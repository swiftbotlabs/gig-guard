# Deliver gate, known-answer run

- **Network:** Telegraph devnode, **testnet**: Ethereum Sepolia escrow rail, Telegraph test USDC. No real money.
- **Paid answers bought:** 2026-11-22 15:44 to 2026-11-23 17:17 UTC (logs: `run-1.log` to `run-4.log`). Results were committed in 5573077; the receipt re-check is in ff86f0b.
- **Receipts:** 38 of 38 SETTLED, 0 pending, 0 mismatched, checked on 2026-11-24 (`receipts-verify.json`, table at the end).
- **The set:** 20 tasks we wrote ourselves, one planted defect per task, truth set by construction. It is not a third-party benchmark.

40 cases ran (20 tasks, each with a correct result and one with a planted defect). Gate verdicts: **18 SUBMIT, 20 FIX, 2 HOLD**. HOLD means the gate did not decide: the judgement was not a clear pass, so a human looks. It is counted apart from SUBMIT and FIX. (In the JSON, `decided` = cases that ran to a gate verdict, HOLD included.)

```
{
 "cases": 40,
 "decided": 40,
 "done_submitted": 18,
 "done_total": 20,
 "not_done_submitted": 0,
 "not_done_stopped": 20,
 "not_done_total": 20,
 "held": 2,
 "judge_stopped_bad": 17,
 "local_stopped_bad": 2,
 "held_unclear_bad": 1,
 "judge_pass_on_bad": 0,
 "judge_none_on_bad": 2,
 "judge_fail_on_good": 1,
 "caught_only_by_local": 3,
 "cost_usd": 0.38,
 "paid_answers": 38,
 "latency_p50_s": 13.2,
 "latency_p95_s": 27.2,
 "cost_per_decided_usd": 0.0095,
 "verdict_submit": 18,
 "verdict_fix": 20,
 "verdict_hold": 2
}
```

## Where the gate did not give the expected verdict

A correct result should be SUBMIT; a defective one must never be SUBMIT (FIX or HOLD both stop it). No defective result was submitted. The cases below are the misses and the holds, with the judge's own words:

- **bug-fix/good** (a correct result) -> HOLD. The judge said: "judge: no verdict (score 10.0): not a clear pass; a human decides"
- **csv-dedupe/good** (a correct result) -> FIX. The judge said: "judge: fails (score 10.0). The result correctly removes the duplicate row '1,Ann' from the input CSV 'id,name\n1,Ann\n2,Bo\n1,Ann' while preserving the header and unique rows as checked against the task description."
- **css-center/bad** (planted defect: only horizontal) -> HOLD. The judge said: "judge: partially_satisfies (score ?): not a clear pass; a human decides"

- Why csv-dedupe/good was stopped: the judge returned the verdict `fails` while its reason describes the result as correct (and gave score 10). The gate reads the verdict and ignores the score, so a self-contradicting `fails` becomes FIX. That is a false stop: it costs a human look, never a bad delivery. A second judge for verdicts that contradict their reason is on the list in `docs/MAINNET.md`.

## Reruns

Two reruns of the same 40 cases (24 Nov) are in [VARIANCE.md](VARIANCE.md): no defective result was submitted in any of the 3 runs (0 / 0 / 0); correct results submitted 18 / 14 / 17 (mean 16.3, range 14-18); HOLD 2 / 9 / 9 (mean 6.7); most extra HOLDs were Miner answers that never arrived (supply), and 3 verdict changes were real judge flips.

## Every case

| case | truth | judge alone | gate | planted defect |
|---|---|---|---|---|
| csv-totals/good | done | pass | SUBMIT |  |
| csv-totals/bad | not_done | none | FIX | wrong total |
| json-keys/good | done | pass | SUBMIT |  |
| json-keys/bad | not_done | fail | FIX | missing key |
| py-even/good | done | pass | SUBMIT |  |
| py-even/bad | not_done | fail | FIX | inverted logic |
| translate-es/good | done | pass | SUBMIT |  |
| translate-es/bad | not_done | fail | FIX | wrong day |
| summary-3/good | done | pass | SUBMIT |  |
| summary-3/bad | not_done | fail | FIX | invented facts |
| sql-count/good | done | pass | SUBMIT |  |
| sql-count/bad | not_done | fail | FIX | wrong query |
| regex-zip/good | done | pass | SUBMIT |  |
| regex-zip/bad | not_done | fail | FIX | unanchored (matches inside longer strings) |
| email-reply/good | done | pass | SUBMIT |  |
| email-reply/bad | not_done | fail | FIX | does the opposite |
| unit-convert/good | done | pass | SUBMIT |  |
| unit-convert/bad | not_done | fail | FIX | wrong conversion |
| readme-install/good | done | pass | SUBMIT |  |
| readme-install/bad | not_done | none | FIX | missing the required command |
| dates-iso/good | done | pass | SUBMIT |  |
| dates-iso/bad | not_done | fail | FIX | malformed date |
| bug-fix/good | done | unclear | HOLD |  |
| bug-fix/bad | not_done | fail | FIX | still wrong range |
| tweet-limit/good | done | pass | SUBMIT |  |
| tweet-limit/bad | not_done | fail | FIX | over the limit and no trial |
| extract-amount/good | done | pass | SUBMIT |  |
| extract-amount/bad | not_done | fail | FIX | transposed digits |
| sort-list/good | done | pass | SUBMIT |  |
| sort-list/bad | not_done | fail | FIX | case-sensitive sort, not alphabetical |
| api-status/good | done | pass | SUBMIT |  |
| api-status/bad | not_done | fail | FIX | factually wrong |
| csv-dedupe/good | done | fail | FIX |  |
| csv-dedupe/bad | not_done | fail | FIX | duplicates left in |
| percent/good | done | pass | SUBMIT |  |
| percent/bad | not_done | fail | FIX | wrong arithmetic |
| css-center/good | done | pass | SUBMIT |  |
| css-center/bad | not_done | unclear | HOLD | only horizontal |
| password-rule/good | done | pass | SUBMIT |  |
| password-rule/bad | not_done | fail | FIX | off by one |

## Receipt settlement

Checked on 2026-11-24: **38 of 38 SETTLED**, 0 pending, 0 mismatched, 0 other. SETTLED means the receipt is listed in its epoch block on the Telegraph node with the same intent and amount. Re-check any receipt: `GET https://devnode.telegraphprotocol.com/v1/blocks/{epoch}/deliveries/{receipt_hash}`, or the "Check receipts live" button on the replay page.

| case | intent | miner | epoch | receipt | status |
|---|---|---|---|---|---|
| csv-totals/good | TASK_EXECUTION_QUALITY_GENERAL | 6119 | 38 | `0xf4ec040ecd2ff1e95d578636d45ca60dfe1157b2d01930c8693de610a95c18c5` | SETTLED |
| json-keys/good | TASK_EXECUTION_QUALITY_GENERAL | 5311 | 38 | `0x5e39e5504d298e2540a1830190c565623eeb29a91804120322a12db294d29ee8` | SETTLED |
| json-keys/bad | TASK_EXECUTION_QUALITY_GENERAL | 5311 | 38 | `0x35490f3c8881ae1a124d39e1c4499ca99c048b268ea1c3dc083999ad53da4779` | SETTLED |
| py-even/good | TASK_EXECUTION_QUALITY_GENERAL | 5311 | 38 | `0x0dd7bef25a69e33e2ef4c3871710e57b6ee478eb1d02c1d63eb15c3db8ee37a2` | SETTLED |
| py-even/bad | TASK_EXECUTION_QUALITY_GENERAL | 5311 | 38 | `0xf1c96550efc0170269543ff6a6449e2240c6a31756171ee8fff738f4ca20a82f` | SETTLED |
| translate-es/good | TASK_EXECUTION_QUALITY_GENERAL | 6119 | 38 | `0xd0726f13b8f79caa022d657e664229e1714286c2c4a441097228f97f5b695e77` | SETTLED |
| translate-es/bad | TASK_EXECUTION_QUALITY_GENERAL | 6119 | 38 | `0x1604979da169a97f64bf76379d521528a864c66fa3d2f15e0d052d07f81c6fec` | SETTLED |
| summary-3/good | TASK_EXECUTION_QUALITY_GENERAL | 5311 | 38 | `0x11185ad654932067ce3524ca1e838222e093b64c4c5f06b01ab4aa6fe7cf2060` | SETTLED |
| summary-3/bad | TASK_EXECUTION_QUALITY_GENERAL | 5311 | 38 | `0xec5e7a3748e8b244c8241737e45053ca76a1a45da41299a88757d85ce2443323` | SETTLED |
| sql-count/good | TASK_EXECUTION_QUALITY_GENERAL | 6119 | 38 | `0x9a0301d86c556995d7e8824dbf4173374b5556395cc06f2a8162f611fe9376c5` | SETTLED |
| sql-count/bad | TASK_EXECUTION_QUALITY_GENERAL | 6119 | 38 | `0xf75a26ad16fb592f561a30b0e6089e5592591567428dd2f74b75ce5d396fc37a` | SETTLED |
| regex-zip/good | TASK_EXECUTION_QUALITY_GENERAL | 5311 | 38 | `0xa51452bdc45876df41d2b3adc4880083c5109f4cad2969c71a6622c5b8553b84` | SETTLED |
| regex-zip/bad | TASK_EXECUTION_QUALITY_GENERAL | 6119 | 38 | `0xdf516f3ca44271d4bb43df73a69c3e458ecbc937d82d6047fc4e2e843ddf7278` | SETTLED |
| email-reply/good | TASK_EXECUTION_QUALITY_GENERAL | 6119 | 38 | `0x2738a55b4112e2c80a3cc5fe1481df548201859dd20199289b6b99cd23f5fdb4` | SETTLED |
| email-reply/bad | TASK_EXECUTION_QUALITY_GENERAL | 6119 | 38 | `0x3c5698de585f7819922c6f549571e20769a9aa731168c6616ba940d4bd8d0750` | SETTLED |
| unit-convert/good | TASK_EXECUTION_QUALITY_GENERAL | 6119 | 38 | `0xad35c9656a820ecc798916d757124b13e2ad22b61961f61c95e37c297a8382c9` | SETTLED |
| unit-convert/bad | TASK_EXECUTION_QUALITY_GENERAL | 6119 | 38 | `0xf49426e3611744afc4a9cc378878aeb502035652cfda08129348d0f7de8f063a` | SETTLED |
| readme-install/good | LLM_OUTPUT_EVALUATION_GENERAL | 4880 | 38 | `0x9aab039c8e1b53c21fe254a26967e090a61eb7a48d3e8200f640b668b62a0635` | SETTLED |
| dates-iso/good | TASK_EXECUTION_QUALITY_GENERAL | 6119 | 38 | `0x7d5eac72b130fd612080c1d85326df45169f223ec3270b111b10b1f53cbe8a14` | SETTLED |
| dates-iso/bad | TASK_EXECUTION_QUALITY_GENERAL | 6119 | 38 | `0x802e2dede71b51ccdb538c123f422a0949757003dbd9e4aeb1f4e38617fe8fc2` | SETTLED |
| bug-fix/good | TASK_EXECUTION_QUALITY_GENERAL | 5311 | 38 | `0xbb90f3bfbb01cae5b77e1d28a7309bda0797f89cb9421d539a05eec52259e6dc` | SETTLED |
| bug-fix/bad | TASK_EXECUTION_QUALITY_GENERAL | 6119 | 38 | `0xaece92e268fc04ba45bfb4fa131b017b74fb9335693af7d08cf4cf2b00219be8` | SETTLED |
| tweet-limit/good | TASK_EXECUTION_QUALITY_GENERAL | 6119 | 38 | `0xd581c0ad5e255f3ad9ee2f095ed764dd92eded617195000d56803fe7e4fbf81b` | SETTLED |
| tweet-limit/bad | TASK_EXECUTION_QUALITY_GENERAL | 6119 | 38 | `0xb8d0e2bed83b2c96c6e3eb4905bad5622f74e4f7fde2e2fb8892d2765b82ee2c` | SETTLED |
| extract-amount/good | TASK_EXECUTION_QUALITY_GENERAL | 6119 | 38 | `0x8d4d38143e7945c5d2f9d99bc7677c83a6be56ea89422275fbd6681b202e39a8` | SETTLED |
| extract-amount/bad | TASK_EXECUTION_QUALITY_GENERAL | 6119 | 38 | `0x78aec933b36808513db32e14d233c6b17b7bb8d9ffe54d97bef889c54dae8076` | SETTLED |
| sort-list/good | TASK_EXECUTION_QUALITY_GENERAL | 5311 | 38 | `0xfb1c5911d36b48005a6272aaa2adc19a01da1cd5865cd1e0b80725ccf130eca5` | SETTLED |
| sort-list/bad | TASK_EXECUTION_QUALITY_GENERAL | 6119 | 38 | `0x6af68e43660df46c9a5f016e53c2b03a8683e298d03ee7023787e698b3747251` | SETTLED |
| api-status/good | TASK_EXECUTION_QUALITY_GENERAL | 6119 | 38 | `0xcdd36f4a6aa871bf5d1d6e249e78156580667a35921daad5efebfd22de288155` | SETTLED |
| api-status/bad | TASK_EXECUTION_QUALITY_GENERAL | 6119 | 38 | `0xaa3fc6e71d03ecdad1286d622c5b538d58cae4fc2c0d9d9cc7b627e984ed2b63` | SETTLED |
| csv-dedupe/good | TASK_EXECUTION_QUALITY_GENERAL | 5311 | 38 | `0x245685e8fb6cd1ac96fad6f75bb6c2b8236ffe24cdecfea108fc62eda9db4222` | SETTLED |
| csv-dedupe/bad | TASK_EXECUTION_QUALITY_GENERAL | 5311 | 38 | `0x51101613c948424a5cdd02bdc5cbdfd9415494e5bb417c9ca26e01e4506c57ef` | SETTLED |
| percent/good | TASK_EXECUTION_QUALITY_GENERAL | 4425 | 45 | `0xc01ee8f3dbc3518ac029a3b83cbf2e6c48c3257b8d80301d80a402720e5a72b5` | SETTLED |
| percent/bad | TASK_EXECUTION_QUALITY_GENERAL | 4425 | 45 | `0x6e66e8616c647d4b53814d831358fefc826fe9dad2b43f38441e983361ee849d` | SETTLED |
| css-center/good | TASK_EXECUTION_QUALITY_GENERAL | 4425 | 45 | `0x22b1d42be74fce496a66ce058300a383c14e586b970c6b6db5d050c47174d912` | SETTLED |
| css-center/bad | TASK_EXECUTION_QUALITY_GENERAL | 4425 | 45 | `0x1d78fbb147b8539b2a45df682bb360898293b8ff06ace4498a1c0ffe63febe1b` | SETTLED |
| password-rule/good | TASK_EXECUTION_QUALITY_GENERAL | 6119 | 45 | `0xfa10b1fbbb5a086eeb68b9476819e5a6c0f42c29f80e0f75e193e020ccac798c` | SETTLED |
| password-rule/bad | TASK_EXECUTION_QUALITY_GENERAL | 6119 | 45 | `0xd09d6414207fa20765843d1fa26577f758b83b084d38360015aea4fcdc0a4cf4` | SETTLED |
