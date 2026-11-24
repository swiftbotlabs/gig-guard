// Drop-in integrations against a fake hosted done-check (no network, no funds): the client, the MCP stdio server, the tool-call handler.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";

let down = false;
const srv = http.createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
  res.setHeader("content-type", "application/json");
  if (down) { res.writeHead(429); return res.end('{"error":"this connection has used its 5 checks for today (UTC)"}'); }
  const { result, mustInclude = [] } = JSON.parse(b);
  const bad = /> 12/.test(result), missing = mustInclude.filter((m) => !result.includes(m));
  res.end(JSON.stringify({ verdict: bad || missing.length ? "FIX" : "SUBMIT", reasons: [bad ? "judge: fails. uses > instead of >=" : "judge: satisfies"], missing,
    receipt: { receipt_hash: "0x" + "ab".repeat(32), epoch_id: 45, intent: "TASK_EXECUTION_QUALITY_GENERAL", amount_uusdc: 10000 } }));
}); });
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const URL_ = `http://127.0.0.1:${srv.address().port}`;
process.env.DONECHECK_URL = URL_;
const { doneCheck } = await import("../integrations/donecheck-client.mjs");
const { handleToolCall, doneCheckTool } = await import("../integrations/tool-call-loop.mjs");
test.after(() => srv.close());
const T = "Write a one-line JavaScript expression that is true when the string s has at least 12 characters.";

test("client: SUBMIT / FIX from the hosted check; a refusal or an unreachable check is HOLD (fail closed), never SUBMIT", async () => {
  assert.equal((await doneCheck({ task: T, result: "s.length >= 12" })).verdict, "SUBMIT");
  assert.equal((await doneCheck({ task: T, result: "s.length > 12" })).verdict, "FIX");
  down = true; const r = await doneCheck({ task: T, result: "s.length >= 12" }); down = false;
  assert.equal(r.verdict, "HOLD"); assert.match(r.error, /5 checks/);
  assert.equal((await doneCheck({ task: T, result: "x" }, { url: "http://127.0.0.1:1" })).verdict, "HOLD");
  await assert.rejects(doneCheck({ task: "", result: "x" }));
});
test("tool-call handler: tells the model to finish only on SUBMIT, and to redo on FIX", async () => {
  assert.equal(doneCheckTool.name, "done_check"); assert.deepEqual(doneCheckTool.input_schema.required, ["task", "result"]);
  assert.match(await handleToolCall({ task: T, result: "s.length >= 12" }), /^SUBMIT\..*may tell the user it is done/);
  assert.match(await handleToolCall({ task: T, result: "s.length > 12" }), /^FIX\..*Do not say done/);
});
test("MCP stdio server: initialize, tools/list shows done_check, tools/call returns the verdict", async () => {
  const p = spawn(process.execPath, [new URL("../integrations/mcp-donecheck.mjs", import.meta.url).pathname], { env: { ...process.env, DONECHECK_URL: URL_ } });
  const lines = []; let buf = "";
  p.stdout.on("data", (c) => { buf += c; let i; while ((i = buf.indexOf("\n")) >= 0) { lines.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1); } });
  const ask = (m) => p.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...m }) + "\n");
  const waitFor = async (id) => { for (let k = 0; k < 200; k++) { const r = lines.find((l) => l.id === id); if (r) return r; await new Promise((r) => setTimeout(r, 20)); } throw new Error("no reply " + id); };
  ask({ id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } } });
  assert.equal((await waitFor(1)).result.serverInfo.name, "gig-guard-done-check");
  ask({ method: "notifications/initialized" });
  ask({ id: 2, method: "tools/list" });
  assert.equal((await waitFor(2)).result.tools[0].name, "done_check");
  ask({ id: 3, method: "tools/call", params: { name: "done_check", arguments: { task: T, result: "s.length > 12" } } });
  const r = await waitFor(3);
  assert.match(r.result.content[0].text, /^FIX: judge: fails/); assert.equal(r.result.structuredContent.verdict, "FIX");
  ask({ id: 4, method: "tools/call", params: { name: "nope", arguments: {} } });
  assert.equal((await waitFor(4)).error.code, -32602);
  p.kill();
});
