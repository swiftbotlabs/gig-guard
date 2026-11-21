import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.GG_LEDGER = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gg-")), "ledger.jsonl");
const { stripComments, fitForReview } = await import("../src/solsrc.mjs");
const { shipCheck } = await import("../src/guards.mjs");

test("stripComments removes // and /* */ comments but keeps string literals and code", () => {
  const src = 'pragma solidity ^0.8.0;\n// a comment\ncontract A { /* block\n comment */ string s = "http://x // not a comment"; string t = \'/* nor this */\'; }\n\n';
  assert.equal(stripComments(src), 'pragma solidity ^0.8.0;\ncontract A {  string s = "http://x // not a comment"; string t = \'/* nor this */\'; }\n');
});

test("fitForReview: short code is sent as written; long code only without comments; never cut", () => {
  assert.deepEqual(fitForReview("contract A {}", 2000), { text: "contract A {}", stripped: false });
  const commented = "contract A {\n" + "// note\n".repeat(400) + "}\n";
  assert.deepEqual(fitForReview(commented, 2000), { text: "contract A {\n}\n", stripped: true });
  assert.equal(fitForReview("contract A {\n" + "  uint x;\n".repeat(400) + "}\n", 2000), null);
});

test("ship gate: a contract too long for the review Intents is HOLD with no purchase", async () => {
  const code = "pragma solidity ^0.8.0;\ncontract Big {\n" + "  uint256 public v;\n".repeat(200) + "}\n";
  const d = await shipCheck(code, { name: "Big.sol" });
  assert.equal(d.verdict, "HOLD");
  assert.equal(d.cost_usd, 0);
  assert.deepEqual(d.evidence, []);
  assert.match(d.reasons[0], /over the 2000-character limit/);
});
