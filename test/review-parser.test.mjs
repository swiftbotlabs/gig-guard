// The review parser (src/report.mjs) is shared by the ship gate and the scorer. These are the 11 real answers from the
// 2026-11-20 planted-bug run, with what each answer SAYS (not whether the miner was right), plus wording that must not flag.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { flagsCode, flagsSecurity } from "../src/report.mjs";

const answers = JSON.parse(fs.readFileSync(new URL("./fixtures/eval-1120-answers.json", import.meta.url), "utf8"));
const says = (a) => (a.intent === "SECURITY_REVIEW_GENERAL" ? flagsSecurity(a.result) : flagsCode(a.result));

// What each real answer states, read by a person: flagged = the answer itself says the code has a defect.
const STATED = {
  "B01_Reentrancy.sol|CODE_REVIEW_GENERAL": true,      // "has a reentrancy vulnerability"
  "B02_TxOrigin.sol|CODE_REVIEW_GENERAL": true,        // "not secure or sufficiently correct" (was parsed as a pass)
  "B03_Selfdestruct.sol|CODE_REVIEW_GENERAL": true,    // "not correct or safe"
  "B04_Delegatecall.sol|CODE_REVIEW_GENERAL": true,    // verdict Request changes
  "B05_UncheckedCall.sol|CODE_REVIEW_GENERAL": true,   // "Unchecked low-level call return value" (was parsed as a pass)
  "B07_MissingAccessControl.sol|CODE_REVIEW_GENERAL": true, // "not correct ... can permanently lose funds" (was parsed as a pass)
  "C01_SafeTipJar.sol|SECURITY_REVIEW_GENERAL": false, // "No security vulnerabilities were found ... severity is none" + advisory IDs (was parsed as a flag)
  "C01_SafeTipJar.sol|CODE_REVIEW_GENERAL": true,      // Request changes (the miner's opinion; the code is clean by design)
  "C03_Escrow.sol|CODE_REVIEW_GENERAL": true,          // Request changes
  "C04_Counter.sol|SECURITY_REVIEW_GENERAL": false,    // Secure, 0
  "C04_Counter.sol|CODE_REVIEW_GENERAL": false,        // "functionally correct ... minor quality issues"
};

test("parser reads each real answer the way the answer states it", () => {
  assert.equal(answers.length, Object.keys(STATED).length);
  for (const a of answers) assert.equal(says(a), STATED[`${a.sample}|${a.intent}`], `${a.sample} ${a.intent}: ${a.result.summary}`);
});

test("wording that must not flag", () => {
  for (const summary of ["The code is correct and secure.", "No vulnerabilities were found.", "Functionally correct; minor style issues.",
    "No security vulnerabilities were found. Overall severity is none."]) {
    assert.equal(flagsCode({ verdict: "Approve", findings: [], summary }), false, summary);
    assert.equal(flagsSecurity({ verdict: null, issues: ["GHSA-xxxx"], summary }), /no .*vulnerabilit|severity is none/i.test(summary) ? false : true, summary);
  }
});

test("wording that must flag", () => {
  for (const summary of ["The contract is not safe: anyone can call sweep.", "Uses tx.origin for auth.", "This is vulnerable to reentrancy.",
    "The owner can permanently lose funds."]) assert.equal(flagsCode({ verdict: "Comment", findings: null, summary }), true, summary);
  assert.equal(flagsSecurity({ verdict: "Insecure", vulnerability_count: 2 }), true);
});
