// Framework-free example: give a chat model's tool-calling loop a "done_check" tool, and let it finish only on SUBMIT.
// The schema works as-is for the Anthropic Messages API (`tools: [doneCheckTool]`) and, wrapped as {type:"function", function:{...}}
// with `parameters` instead of `input_schema`, for OpenAI-style APIs. `handleToolCall` is what your loop runs when the model calls it.
import { doneCheck } from "./donecheck-client.mjs";

export const doneCheckTool = {
  name: "done_check",
  description: "Call this BEFORE telling the user a task is finished. Returns SUBMIT (finish), FIX (redo using the reason) or HOLD (ask the user).",
  input_schema: { type: "object", required: ["task", "result"], properties: {
    task: { type: "string" }, result: { type: "string" }, mustInclude: { type: "array", items: { type: "string" }, maxItems: 5 } } },
};

/** Runs one done_check tool call and returns the string to send back as the tool result. */
export async function handleToolCall(input, opts) {
  const v = await doneCheck({ task: input.task, result: input.result, mustInclude: input.mustInclude || [] }, opts);
  const next = { SUBMIT: "You may tell the user it is done.", FIX: "Do not say done: fix the result using the reason, then call done_check again.",
    HOLD: "Do not say done: tell the user the check was unclear and show your result." }[v.verdict];
  return `${v.verdict}. ${(v.reasons || []).join(" ")} ${next}${v.receipt ? ` Receipt: ${v.receipt.receipt_hash}.` : ""}`;
}

// Loop sketch (any provider): while (true) { resp = await model(messages, [doneCheckTool]);
//   if (resp has a done_check tool call) { messages.push(toolResult(await handleToolCall(call.input))); continue; }
//   break; }   // the system prompt says: "Never claim a task is done without a SUBMIT from done_check."
