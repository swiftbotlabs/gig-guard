# Outsider blind set (LLMBar): live runs on Telegraph testnet

- 10 LLMBar items (5 Natural, 5 Adversarial) = 20 cases. Tasks, outputs and labels were written by the LLMBar authors (Princeton NLP, MIT licence), not by us; the items were picked by a fixed rule in `build.mjs`, not by hand.
- Frozen before any run: sha256 `6099606dc4149ec9d8e8f61cc78f56d68fa7f77405a0bdc3c36ff1f6a11e3985` (OUTSIDER.sha256, committed first). The gate code was not changed between runs.
- Scoring: the human-preferred output should get SUBMIT; the other should not. LLMBar labels are pairwise preferences, so a 'not_done' output may be partly acceptable: a SUBMIT on it is counted as a false SUBMIT anyway.

```
{
 "runs": 1,
 "cases": 20,
 "bad_total": 10,
 "good_total": 10,
 "false_submit": {
  "mean": 0,
  "min": 0,
  "max": 0
 },
 "good_submitted": {
  "mean": 0,
  "min": 0,
  "max": 0
 },
 "hold": {
  "mean": 3,
  "min": 3,
  "max": 3
 },
 "hold_no_answer": {
  "mean": 0,
  "min": 0,
  "max": 0
 },
 "pairs_right": {
  "mean": 0,
  "min": 0,
  "max": 0
 },
 "cost_per_decision_usd": 0.0124
}
```

| case | source | truth | run 1 |
|---|---|---|---|
| llmbar-027ca771/good | Natural | done | FIX |
| llmbar-027ca771/bad | Natural | not_done | FIX |
| llmbar-03cfed37/good | Natural | done | FIX |
| llmbar-03cfed37/bad | Natural | not_done | HOLD |
| llmbar-097d4311/good | Natural | done | FIX |
| llmbar-097d4311/bad | Natural | not_done | HOLD |
| llmbar-0cfbeddb/good | Natural | done | FIX |
| llmbar-0cfbeddb/bad | Natural | not_done | HOLD |
| llmbar-1251c27b/good | Natural | done | FIX |
| llmbar-1251c27b/bad | Natural | not_done | FIX |
| llmbar-006c2855/good | Adversarial/Neighbor | done | FIX |
| llmbar-006c2855/bad | Adversarial/Neighbor | not_done | FIX |
| llmbar-02e54eed/good | Adversarial/Neighbor | done | FIX |
| llmbar-02e54eed/bad | Adversarial/Neighbor | not_done | FIX |
| llmbar-04b7bbd7/good | Adversarial/Neighbor | done | FIX |
| llmbar-04b7bbd7/bad | Adversarial/Neighbor | not_done | FIX |
| llmbar-05a1a4b3/good | Adversarial/Manual | done | FIX |
| llmbar-05a1a4b3/bad | Adversarial/Manual | not_done | FIX |
| llmbar-0677f52b/good | Adversarial/Manual | done | FIX |
| llmbar-0677f52b/bad | Adversarial/Manual | not_done | FIX |

Per run:

```
{"file":"eval/deliver/outsider/confirm-run-1.public.jsonl","ran":20,"bad_submitted":0,"good_submitted":0,"hold":3,"hold_no_answer":0,"pairs_right":0,"cost_usd":0.21,"decided":17}
```
