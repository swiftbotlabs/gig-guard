#!/usr/bin/env node
// MCP server (stdio) with one tool, "done_check": any MCP client (Claude Desktop, Claude Code, Cursor...) can ask it before saying "done".
// No dependencies: newline-delimited JSON-RPC 2.0 over stdin/stdout, per the MCP stdio transport.
// Config example (Claude Desktop / Claude Code):  { "mcpServers": { "done-check": { "command": "node", "args": ["/path/to/gig-guard/integrations/mcp-donecheck.mjs"] } } }
import readline from "node:readline";
import { doneCheck } from "./donecheck-client.mjs";

const TOOL = {
  name: "done_check",
  description: "Before telling the user a task is done, check the actual result against the task. A paid Telegraph Miner judges it (testnet) and the "
    + "required items are checked for free. Returns SUBMIT (say done), FIX (redo it) or HOLD (ask the user), with a receipt.",
  inputSchema: { type: "object", required: ["task", "result"], properties: {
    task: { type: "string", description: "What the user asked for." },
    result: { type: "string", description: "What you produced (task + result at most 2,000 characters)." },
    mustInclude: { type: "array", items: { type: "string" }, maxItems: 5, description: "Optional strings the result must contain." } } },
};
const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", async (line) => {
  let m; try { m = JSON.parse(line); } catch { return send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }); }
  const reply = (result) => m.id !== undefined && send({ jsonrpc: "2.0", id: m.id, result });
  const fail = (code, message) => m.id !== undefined && send({ jsonrpc: "2.0", id: m.id, error: { code, message } });
  if (m.method === "initialize") return reply({ protocolVersion: m.params?.protocolVersion || "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "gig-guard-done-check", version: "0.1.0" } });
  if (m.method === "notifications/initialized" || m.method?.startsWith("notifications/")) return;
  if (m.method === "ping") return reply({});
  if (m.method === "tools/list") return reply({ tools: [TOOL] });
  if (m.method === "tools/call") {
    if (m.params?.name !== "done_check") return fail(-32602, "unknown tool");
    try {
      const a = m.params.arguments || {};
      const v = await doneCheck({ task: a.task, result: a.result, mustInclude: Array.isArray(a.mustInclude) ? a.mustInclude : [] });
      const text = `${v.verdict}: ${(v.reasons || []).join(" | ")}${v.receipt ? ` (receipt ${v.receipt.receipt_hash}, epoch ${v.receipt.epoch_id})` : ""}${v.error ? ` [${v.error}]` : ""}`;
      return reply({ content: [{ type: "text", text }], structuredContent: v, isError: false });
    } catch (e) { return reply({ content: [{ type: "text", text: `HOLD: ${e.message}` }], isError: true }); }
  }
  return fail(-32601, "method not found");
});
