// The unsigned first leg is retried once on a connection failure; aborts and the signed leg are never retried. Error text keeps the cause.
import { test } from "node:test";
import assert from "node:assert/strict";
import { unsignedLeg, errText } from "../src/telegraph.mjs";
const fail = () => { const e = new TypeError("fetch failed"); e.cause = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }); return e; };

test("unsigned leg: one retry after a connection failure, then the real answer", async () => {
  let n = 0; const f = async () => { if (n++ === 0) throw fail(); return { status: 402 }; };
  assert.equal((await unsignedLeg("u", {}, { fetchImpl: f, pauseMs: 1 })).status, 402); assert.equal(n, 2);
});
test("unsigned leg: two failures in a row throw (no loop); an abort or a non-network error is not retried", async () => {
  let n = 0; await assert.rejects(unsignedLeg("u", {}, { fetchImpl: async () => { n++; throw fail(); }, pauseMs: 1 }), /fetch failed/); assert.equal(n, 2);
  n = 0; const ac = new AbortController(); ac.abort();
  await assert.rejects(unsignedLeg("u", { signal: ac.signal }, { fetchImpl: async () => { n++; throw fail(); }, pauseMs: 1 })); assert.equal(n, 1);
  n = 0; await assert.rejects(unsignedLeg("u", {}, { fetchImpl: async () => { n++; throw new Error("boom"); }, pauseMs: 1 })); assert.equal(n, 1);
});
test("error text keeps the cause code", () => {
  assert.equal(errText(fail()), "fetch failed (ECONNRESET: read ECONNRESET)");
  assert.equal(errText(new Error("x")), "x");
});
