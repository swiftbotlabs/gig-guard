# Simulated reward logic on the 129-contract run (Mission 14, Route 3)

No money moves. Each contract review is treated as a bug report to a test bounty program. The program pays (in simulation) only when the gate says FIX **and** a deterministic local rule confirms the finding; Miner-only findings wait for human reproduction; SHIP closes, HOLD goes to a human. Severity comes from the confirmed SWC id, never from a Miner's own rating. One reward per (contract, SWC id); a $10,000 pool caps the total. Policy: `src/reward.mjs`; tests: `test/reward.test.mjs`.

Scored against the dataset labels (SmartBugs = vulnerable, OpenZeppelin = audited), using the same latest decision per contract as RESULTS.md. Rewards cite the paid receipts the decision was based on (rewards.json).

```
{
 "reports": 129,
 "auto_approved": 23,
 "auto_on_vulnerable": 23,
 "wrongful_payouts": 0,
 "pending_reproduction": 76,
 "human": 22,
 "closed": 8,
 "closed_on_vulnerable": 0,
 "usd_paid": 7600,
 "pool_left": 2400,
 "by_status": {
  "auto-approved (rule-confirmed)": 23,
  "pending reproduction: Miner-only finding": 76,
  "human review: evidence unclear": 22,
  "closed: no vulnerability": 8
 }
}
```

| contract | label | status | severity | simulated USD |
|---|---|---|---|---|
| SB_access_control_arbitrary_location_write_simple.sol | vulnerable | auto-approved (rule-confirmed) | high | 500 |
| SB_access_control_FibonacciBalance.sol | vulnerable | auto-approved (rule-confirmed) | high | 500 |
| SB_access_control_mycontract.sol | vulnerable | auto-approved (rule-confirmed) | high | 500 |
| SB_access_control_phishable.sol | vulnerable | auto-approved (rule-confirmed) | high | 500 |
| SB_access_control_proxy.sol | vulnerable | auto-approved (rule-confirmed) | high | 500 |
| SB_access_control_rubixi.sol | vulnerable | human review: evidence unclear |  | 0 |
| SB_access_control_simple_suicide.sol | vulnerable | auto-approved (rule-confirmed) | high | 500 |
| SB_arithmetic_BECToken.sol | vulnerable | human review: evidence unclear |  | 0 |
| SB_bad_randomness_blackjack.sol | vulnerable | human review: evidence unclear |  | 0 |
| SB_bad_randomness_etheraffle.sol | vulnerable | human review: evidence unclear |  | 0 |
| SB_bad_randomness_guess_the_random_number.sol | vulnerable | auto-approved (rule-confirmed) | medium | 200 |
| SB_bad_randomness_lottery.sol | vulnerable | auto-approved (rule-confirmed) | high | 500 |
| SB_bad_randomness_lucky_doubler.sol | vulnerable | human review: evidence unclear |  | 0 |
| SB_bad_randomness_old_blockhash.sol | vulnerable | auto-approved (rule-confirmed) | medium | 200 |
| SB_bad_randomness_random_number_generator.sol | vulnerable | auto-approved (rule-confirmed) | medium | 200 |
| SB_denial_of_service_list_dos.sol | vulnerable | human review: evidence unclear |  | 0 |
| SB_front_running_ERC20.sol | vulnerable | human review: evidence unclear |  | 0 |
| SB_other_crypto_roulette.sol | vulnerable | auto-approved (rule-confirmed) | high | 500 |
| SB_other_open_address_lottery.sol | vulnerable | human review: evidence unclear |  | 0 |
| SB_reentrancy_0x627f…7839.sol | vulnerable | auto-approved (rule-confirmed) | medium | 200 |
| SB_reentrancy_0x7a87…9782.sol | vulnerable | auto-approved (rule-confirmed) | high | 500 |
| SB_short_addresses_short_address_example.sol | vulnerable | auto-approved (rule-confirmed) | high | 500 |
| SB_unchecked_low_level_calls_0x07f7…0f2e.sol | vulnerable | human review: evidence unclear |  | 0 |
| SB_unchecked_low_level_calls_0x0cbe…acc9.sol | vulnerable | auto-approved (rule-confirmed) | medium | 200 |
| SB_unchecked_low_level_calls_0x2972…3fd2.sol | vulnerable | auto-approved (rule-confirmed) | medium | 200 |
| SB_unchecked_low_level_calls_0x39cf…abfa.sol | vulnerable | auto-approved (rule-confirmed) | medium | 200 |
| SB_unchecked_low_level_calls_0x3a0e…2b01.sol | vulnerable | auto-approved (rule-confirmed) | medium | 200 |
| SB_unchecked_low_level_calls_0x3f2e…1de2.sol | vulnerable | human review: evidence unclear |  | 0 |
| SB_unchecked_low_level_calls_0x4051…6ef3.sol | vulnerable | auto-approved (rule-confirmed) | medium | 200 |
| SB_unchecked_low_level_calls_0x4a66…504c.sol | vulnerable | auto-approved (rule-confirmed) | medium | 200 |
| SB_unchecked_low_level_calls_0x4b71…b152.sol | vulnerable | auto-approved (rule-confirmed) | medium | 200 |
| SB_unchecked_low_level_calls_0x5249…d7b1.sol | vulnerable | auto-approved (rule-confirmed) | medium | 200 |
| SB_unchecked_low_level_calls_0x627f…7839.sol | vulnerable | auto-approved (rule-confirmed) | medium | 200 |
| SB_unchecked_low_level_calls_0x70f9…2db4.sol | vulnerable | human review: evidence unclear |  | 0 |
| SB_unchecked_low_level_calls_0x78c2…1c37.sol | vulnerable | human review: evidence unclear |  | 0 |
| SB_unchecked_low_level_calls_0x7a43…5489.sol | vulnerable | human review: evidence unclear |  | 0 |
| SB_unchecked_low_level_calls_0x7d09…06b4.sol | vulnerable | human review: evidence unclear |  | 0 |
| SB_unchecked_low_level_calls_0x806a…a707.sol | vulnerable | human review: evidence unclear |  | 0 |
| OZ_access_AccessControl.sol | audited | human review: evidence unclear |  | 0 |
| OZ_utils_Nonces.sol | audited | closed: no vulnerability |  | 0 |
| OZ_utils_Address.sol | audited | human review: evidence unclear |  | 0 |
| OZ_utils_Context.sol | audited | closed: no vulnerability |  | 0 |
| OZ_utils_cryptography_ECDSA.sol | audited | human review: evidence unclear |  | 0 |
| OZ_finance_VestingWallet.sol | audited | human review: evidence unclear |  | 0 |
| OZ_token_ERC20_ERC20.sol | audited | human review: evidence unclear |  | 0 |
| OZ_token_ERC20_utils_SafeERC20.sol | audited | human review: evidence unclear |  | 0 |
| OZ_token_ERC20_extensions_ERC20Burnable.sol | audited | closed: no vulnerability |  | 0 |
| OZ_token_ERC20_extensions_ERC20Capped.sol | audited | closed: no vulnerability |  | 0 |
| OZ_token_ERC20_extensions_ERC20Pausable.sol | audited | closed: no vulnerability |  | 0 |
| OZ_token_ERC721_utils_ERC721Holder.sol | audited | closed: no vulnerability |  | 0 |
| OZ_token_ERC1155_utils_ERC1155Holder.sol | audited | closed: no vulnerability |  | 0 |
| OZ_utils_types_Time.sol | audited | human review: evidence unclear |  | 0 |
| OZ_access_manager_AuthorityUtils.sol | audited | closed: no vulnerability |  | 0 |

76 more reports are "pending reproduction: Miner-only finding" (in rewards.json).
