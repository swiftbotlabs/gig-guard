# Same decisions, with and without Telegraph

Each row is one real decision from the ledger. 'Without' replays the same policy on the free checks recorded in that decision; nothing is re-run.

10 decisions. At the time, the paid answers changed 2 of them and confirmed 8. Spend $0.12, $0.060 per changed decision. Failures and doubts logged: 3.
Replayed under today's policy (v6) on the same evidence: 0 verdict(s) overturned, 2 of 10 differ from the free-checks-only verdict ($0.060 per changed decision).

| Gate | Item | Without (free checks only) | With Telegraph, at the time | Today's policy, same evidence | Paid answers | Cost | Failures / doubts |
|---|---|---|---|---|---|---|---|
| claim | payment A (policy before v5) | **PENDING**: no free chain read for this chain/token: no proof either way | **CLAIM**: wallet holds 0 USDT as of 2026-11-18T07:19:40.842Z: payment of $400 not received | same | 1 | $0.01 | none |
| claim | payment B (policy before v5) | **PENDING**: no free chain read for this chain/token: no proof either way | **PENDING**: on-chain check unavailable: not claiming without proof | same | 0 | $0.00 | WALLET_BALANCE_CHECK_GENERAL: no supplier delivered |
| scout | job lead 1 (policy before v5) | **CAUTION**: no link reputation and no payment record: nothing to go on but the job post itself | **CAUTION**: no independent record of Client T paying (5 sources, none mention it) | same | 2 | $0.02 | none |
| claim | payment C (policy before v5) | **PENDING**: no free chain read for this chain/token: no proof either way | **CLAIM**: wallet holds 0 USDT on bsc as of 2026-11-18T07:29:32.102Z: payment of $400 not received | same | 1 | $0.01 | none |
| scout | job lead 2 (policy v5) | **CAUTION**: no link reputation and no payment record: nothing to go on but the job post itself | **CAUTION**: no independent record of Client T paying (5 sources, none mention it) | same | 2 | $0.02 | none |
| ship | Vault.sol (policy v5) | **FIX**: local rules only: tx.origin used for auth (SWC-115); state written after external call (SWC-107 reentrancy) | **FIX**: security: null (2) CWE-863, CWE-841 | same | 2 | $0.02 | none |
| ship | SafeVault.sol (policy v5) | **SHIP**: local rules found nothing, and nobody else reviewed it | **SHIP**: security: Secure; CODE_REVIEW_GENERAL: Approve | same | 2 | $0.02 | none |
| claim | payment D (policy v5) | **CLAIM**: one source only (public RPC): balance 0 | **CLAIM**: chain read agrees (0) | same | 1 | $0.01 | none |
| claim | payment E (user says no) (policy v5) | **CLAIM**: one source only (public RPC): balance 0 | **CLAIM**: chain read agrees (0) | same | 0 (+1 reused) | $0.00 | none |
| claim | payment F (policy v5) | **PENDING**: no free chain read for this chain/token: no proof either way | **PENDING**: no miner returned a USDT balance on tron (1 paid answer came back empty): chain or token likely unsupported, not claimin | same | 0 | $0.01 | WALLET_BALANCE_CHECK_GENERAL: empty answer; WALLET_BALANCE_CHECK_GENERAL: no supplier delivered |
