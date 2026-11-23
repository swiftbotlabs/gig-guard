# Deliver gate, known-answer run

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
 "cost_per_decided_usd": 0.0095
}
```

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
