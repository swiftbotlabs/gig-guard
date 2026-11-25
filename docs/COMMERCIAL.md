# Commercial summary

**Buyer.** Teams that run agents which do paid work for other people: agent freelancers, bounty and task agents, and agent platforms that pay out when a task is marked done.
The cost they carry today is a wrong "done". It means a refund, rework and a client who doesn't come back.
The usual alternatives are the agent grading its own work, or a person spot-checking.

**What they pay for.** One call before "done" returns SUBMIT, FIX or HOLD with a receipt.
It fails closed: no answer means HOLD, never SUBMIT.

**Unit economics (testnet numbers; mainnet prices are not published yet).**
- Cost to us per decision: $0.009 (done-check) and $0.020 per right contract decision (two paid reviews). Telegraph Miner prices, measured.
- Price we would charge on mainnet: $0.03 per check pay-as-you-go, or $19 a month for 1,000 checks.
  At $0.03 against a $0.01 Miner price, the margin pays for the hosted service and a second opinion on unclear cases.
- Break-even for the buyer, as an illustration with an assumed number: if one wrong "done" costs a $50 refund, one prevented bad delivery pays for about 1,600 checks at $0.03.
  On our 40-case set, the judge stopped 17 of 20 defective results that the agent would otherwise have delivered. On an outside set (LLMBar) it was too lenient: 3 to 4 of 10 weaker outputs passed per run (runs 1-2).

**Status, honestly.**
- No paying customer.
- No pilot or letter of intent yet.
- Our own agent has used the gates on its own bounty work (scout, claim and ship decisions on 18 Nov), so it is our first user, not a customer.
- Independent use is counted publicly by integration at https://donecheck.swiftbotlab.workers.dev/api/stats. The count includes our own smoke runs.

**Path to revenue.** Mainnet switch (docs/MAINNET.md), then metered keys on the hosted check, then the MCP and npm channels where agent builders already look.
