// Builds the OUTSIDER blind set from LLMBar (Zeng et al., ICLR 2024; princeton-nlp/LLMBar, MIT), pinned to commit 900616b.
// We wrote none of these tasks or outputs and chose none of them by hand. Each LLMBar item is an instruction and two outputs;
// human annotators marked which one follows the instruction. Here the preferred output is "done" and the other is "not_done".
// Selection rule, fixed before any run: from Natural and from Adversarial (GPTInst, GPTOut, Manual, Neighbor pooled), keep the items
// whose instruction + longer output fit the judge's 2,000-character limit (<= 1,900, to leave room), order them by sha256(instruction),
// and take the first 5 of each: 10 items, 20 cases.
//   node eval/deliver/outsider/build.mjs <dir with natural.json adv-*.json>   -> cases.json + OUTSIDER.sha256 (commit BEFORE any run)
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
const SRC = "https://github.com/princeton-nlp/LLMBar/tree/900616bff90b6c6c8e1681f7d079250637c55992/Dataset/LLMBar";
const EXPECT = { "natural.json": "f7127b7aa78104cb8e03a2b1b3ac0077e95b125714dd441a8ee63666145a3375",
  "adv-GPTInst.json": "1002425f73c2cf54b6e6de99bce3f6c60fa2a17d13194772e37d7481c1351d42", "adv-GPTOut.json": "1ff56e520d7607750a9866a3be0f5b850392ca4477a1f69d80f32bd3e310f561",
  "adv-Manual.json": "0d9598769a39cdbbd265778c37e49939d41d5f76dcfb17bd75dcfa07516d3837", "adv-Neighbor.json": "6712c7eda6342602e0bc7c06c282fa95e2110d4e741a284026a62d937f9780a0" };
const dir = process.argv[2]; if (!dir) { console.error("usage: node build.mjs <raw dir>"); process.exit(2); }
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const load = (f) => { const raw = fs.readFileSync(path.join(dir, f)); if (sha(raw) !== EXPECT[f]) throw new Error(`${f}: sha256 differs from the pinned file`); return JSON.parse(raw); };
const fit = (x) => x.input.trim().length + Math.max(x.output_1.trim().length, x.output_2.trim().length) <= 1900;
const pick = (items, n) => items.filter(fit).sort((a, b) => (sha(a.input) < sha(b.input) ? -1 : 1)).slice(0, n);
const nat = pick(load("natural.json").map((x) => ({ ...x, subset: "Natural" })), 5);
const adv = pick(["GPTInst", "GPTOut", "Manual", "Neighbor"].flatMap((s) => load(`adv-${s}.json`).map((x) => ({ ...x, subset: `Adversarial/${s}` }))), 5);
const cases = [];
for (const x of [...nat, ...adv]) {
  const id = `llmbar-${sha(x.input).slice(0, 8)}`, good = x.label === 1 ? x.output_1 : x.output_2, bad = x.label === 1 ? x.output_2 : x.output_1;
  cases.push({ id: `${id}/good`, task: x.input.trim(), result: good.trim(), mustInclude: [], truth: "done", source: x.subset });
  cases.push({ id: `${id}/bad`, task: x.input.trim(), result: bad.trim(), mustInclude: [], truth: "not_done", source: x.subset });
}
const out = JSON.stringify({ note: `Outsider blind set: 10 LLMBar items (5 Natural, 5 Adversarial), chosen by a fixed rule (see build.mjs), human-labelled by the LLMBar authors. Source: ${SRC} (MIT, Copyright (c) 2023 Princeton Natural Language Processing). Frozen before any run.`, cases }, null, 1) + "\n";
fs.writeFileSync(new URL("./cases.json", import.meta.url), out);
fs.writeFileSync(new URL("./OUTSIDER.sha256", import.meta.url), `${sha(out)}  cases.json\n`);
console.log(`${cases.length} cases, sha256 ${sha(out)}`);
