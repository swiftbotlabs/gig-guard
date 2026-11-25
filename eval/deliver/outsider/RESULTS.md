# Outsider blind set (LLMBar): live runs on Telegraph testnet

- 10 LLMBar items (5 Natural, 5 Adversarial) = 20 cases. Tasks, outputs and labels were written by the LLMBar authors (Princeton NLP, MIT licence), not by us; the items were picked by a fixed rule in `build.mjs`, not by hand.
- Frozen before any run: sha256 `6099606dc4149ec9d8e8f61cc78f56d68fa7f77405a0bdc3c36ff1f6a11e3985` (OUTSIDER.sha256, committed first). The gate code was not changed between runs.
- Scoring: the human-preferred output should get SUBMIT; the other should not. LLMBar labels are pairwise preferences, so a 'not_done' output may be partly acceptable: a SUBMIT on it is counted as a false SUBMIT anyway.

```
{
 "runs": 2,
 "cases": 20,
 "bad_total": 10,
 "good_total": 10,
 "false_submit": {
  "mean": 3.5,
  "min": 3,
  "max": 4
 },
 "good_submitted": {
  "mean": 5,
  "min": 3,
  "max": 7
 },
 "hold": {
  "mean": 6,
  "min": 2,
  "max": 10
 },
 "hold_no_answer": {
  "mean": 6,
  "min": 2,
  "max": 10
 },
 "pairs_right": {
  "mean": 3,
  "min": 1,
  "max": 5
 },
 "cost_per_decision_usd": 0.01
}
```

| case | source | truth | run 1 / run 2 |
|---|---|---|---|
| llmbar-027ca771/good | Natural | done | HOLD / SUBMIT |
| llmbar-027ca771/bad | Natural | not_done | HOLD / HOLD |
| llmbar-03cfed37/good | Natural | done | HOLD / HOLD |
| llmbar-03cfed37/bad | Natural | not_done | HOLD / SUBMIT |
| llmbar-097d4311/good | Natural | done | HOLD / SUBMIT |
| llmbar-097d4311/bad | Natural | not_done | HOLD / FIX |
| llmbar-0cfbeddb/good | Natural | done | SUBMIT / SUBMIT |
| llmbar-0cfbeddb/bad | Natural | not_done | SUBMIT / SUBMIT |
| llmbar-1251c27b/good | Natural | done | FIX / FIX |
| llmbar-1251c27b/bad | Natural | not_done | FIX / FIX |
| llmbar-006c2855/good | Adversarial/Neighbor | done | SUBMIT / SUBMIT |
| llmbar-006c2855/bad | Adversarial/Neighbor | not_done | HOLD / FIX |
| llmbar-02e54eed/good | Adversarial/Neighbor | done | HOLD / SUBMIT |
| llmbar-02e54eed/bad | Adversarial/Neighbor | not_done | SUBMIT / SUBMIT |
| llmbar-04b7bbd7/good | Adversarial/Neighbor | done | HOLD / SUBMIT |
| llmbar-04b7bbd7/bad | Adversarial/Neighbor | not_done | FIX / FIX |
| llmbar-05a1a4b3/good | Adversarial/Manual | done | HOLD / SUBMIT |
| llmbar-05a1a4b3/bad | Adversarial/Manual | not_done | FIX / FIX |
| llmbar-0677f52b/good | Adversarial/Manual | done | SUBMIT / FIX |
| llmbar-0677f52b/bad | Adversarial/Manual | not_done | SUBMIT / SUBMIT |

Per run:

```
{"file":"eval/deliver/outsider/run-1.public.jsonl","ran":20,"bad_submitted":3,"good_submitted":3,"hold":10,"hold_no_answer":10,"pairs_right":1,"cost_usd":0.1,"decided":10}
{"file":"eval/deliver/outsider/run-2.public.jsonl","ran":20,"bad_submitted":4,"good_submitted":7,"hold":2,"hold_no_answer":2,"pairs_right":5,"cost_usd":0.18,"decided":18}
```
