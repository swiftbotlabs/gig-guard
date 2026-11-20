# Planted-bug run

Does the ship gate catch known bugs, and what does a correct review cost? 12 short Solidity contracts with a known answer:
8 with one planted bug each, 4 written clean ([`truth.json`](truth.json), sources in [`samples/`](samples/), all compile with solc 0.8.36).

```bash
GG_LEDGER=eval/ledger.eval.jsonl GG_REUSE=0 node eval/run.mjs    # testnet: 2 answers per sample, $0.02 each sample at most
GG_LEDGER=eval/ledger.eval.jsonl node eval/score.mjs             # writes RESULTS.md and results.json
GG_LEDGER=eval/ledger.public.jsonl node eval/score.mjs           # the same numbers from the published ledger, no funds needed
```

Results of the run on 2026-11-20, 08:39–08:53 UTC: [`RESULTS.md`](RESULTS.md). Every request, paid or failed, is in
[`ledger.public.jsonl`](ledger.public.jsonl) with its receipt.

## What we learned (2026-11-20)

1. **Availability was the biggest problem.** 13 of 24 requests failed, with no charge: `SECURITY_REVIEW_GENERAL` 10 of 12 (9 were
   HTTP 500 "context deadline exceeded" after about 62 s, primary and fallback miner both), `CODE_REVIEW_GENERAL` 3 of 12. The gate failed
   closed: 3 samples ended as HOLD, none shipped on a missing review.
2. **Our own parser is the weak link.** On B02 (tx.origin), B05 (unchecked call) and B07 (missing access control) the code-review miner's
   text describes the problem ("Unchecked low-level call return value", "ownership controls are incomplete"), but with verdict "Comment"
   and wording our flag rule doesn't match, so they count as passes. Nothing here is re-scored after the fact: a summary-aware parser will be
   measured on a new run.
3. **False alarms on clean code.** C01 and C03 got "Request changes" for real but minor design points (ETH sent to `receive` is not credited;
   missing validation). The gate treats that as FIX.
4. **A malformed answer.** Miner 719190's review of the clean C01 listed Python advisories (CVE-2025-1889, PYSEC-2025-19) as issues with a
   null verdict, while its own summary says no vulnerabilities. Our null-verdict rule counted that as a flag.
5. **Local rules look better than they are.** They caught 5 of 8 with no false alarms, but we wrote them for exactly those 5 bug classes.
   The 3 classes outside the rules (weak randomness, missing access control, signature replay) were all missed by the rules.

Next run: the same 12 plus new samples, with the summary-aware parser, once the security route answers again.
