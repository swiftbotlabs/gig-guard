// Picks the scale-run set from two public, pinned sources and writes eval/scale/manifest.json + copies into eval/scale/samples/.
//   vulnerable: SmartBugs Curated (Apache-2.0), real contracts with annotated vulnerabilities (vulnerabilities.json).
//               Every file of 12,000 chars or less (the ship gate sends at most 12,000 chars), except that the largest
//               category (unchecked_low_level_calls) is capped at its first 20 by file name, so no single class dominates.
//   clean:      OpenZeppelin Contracts v5.1.0 (MIT), audited library contracts. Label = "audited", not "proven bug-free".
//   node eval/scale/select.mjs <smartbugs-curated dir> <openzeppelin-contracts dir>
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const [sb, oz] = process.argv.slice(2);
const out = new URL("./samples/", import.meta.url).pathname;
fs.mkdirSync(out, { recursive: true });
const MAX = 12000, CAP = { unchecked_low_level_calls: 20 };
const commit = (d) => execFileSync("git", ["-C", d, "rev-parse", "HEAD"]).toString().trim();
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const items = [];
const unlabel = (s) => s
  .replace(/\/\*[\s\S]*?@vulnerable_at_lines[\s\S]*?\*\//g, "")
  .split("\n").filter((l) => !/^\s*\/\/\s*<yes>\s*<report>/i.test(l)).join("\n").replace(/^\s*\n/, "");
const HINT = /reentr|overflow|underflow|random|lottery|dos|denial|front|race|unchecked|short|time|access|owner|vuln|bug|attack|exploit|honeypot/i;

const vulns = JSON.parse(fs.readFileSync(path.join(sb, "vulnerabilities.json"), "utf8"));
const byCat = {};
for (const v of [...vulns].sort((a, b) => a.path.localeCompare(b.path))) {
  // SmartBugs marks the answer inside the file (a header with @vulnerable_at_lines and "// <yes> <report> CATEGORY" lines).
  // Those are removed so a reviewer sees only the contract. Identifiers stay as written (see "hint" below).
  const src = unlabel(fs.readFileSync(path.join(sb, v.path), "utf8"));
  if (src.length > MAX) continue;
  const cat = v.path.split("/")[1];
  byCat[cat] = (byCat[cat] || 0) + 1;
  if (CAP[cat] && byCat[cat] > CAP[cat]) continue;
  const name = `SB_${cat}_${path.basename(v.path)}`;
  fs.writeFileSync(path.join(out, name), src);
  const names = [...src.matchAll(/\b(?:contract|library)\s+(\w+)/g)].map((m) => m[1]);
  items.push({ name, label: "vulnerable", category: cat, lines: v.vulnerabilities.map((x) => x.lines).flat(),
    hint: names.some((n) => HINT.test(n)) || /\/\/[^\n]*(?:vulnerab|attack|exploit|bug)/i.test(src),
    source: `https://github.com/smartbugs/smartbugs-curated/blob/${commit(sb)}/${v.path}`, origin: v.source || null, license: "Apache-2.0", sha256: sha(src) });
}

const OZ = ["access/Ownable.sol", "access/Ownable2Step.sol", "access/AccessControl.sol", "utils/ReentrancyGuard.sol", "utils/Pausable.sol",
  "utils/Nonces.sol", "utils/Address.sol", "utils/Context.sol", "utils/Multicall.sol", "utils/cryptography/ECDSA.sol",
  "utils/cryptography/MessageHashUtils.sol", "finance/VestingWallet.sol", "token/ERC20/ERC20.sol", "token/ERC20/utils/SafeERC20.sol",
  "token/ERC20/extensions/ERC20Burnable.sol", "token/ERC20/extensions/ERC20Capped.sol", "token/ERC20/extensions/ERC20Pausable.sol",
  "token/ERC20/extensions/ERC20Wrapper.sol", "token/ERC721/utils/ERC721Holder.sol", "token/ERC1155/utils/ERC1155Holder.sol",
  "utils/types/Time.sol", "utils/math/SafeCast.sol", "access/manager/AuthorityUtils.sol", "utils/Arrays.sol"];
for (const rel of OZ) {
  const p = path.join(oz, "contracts", rel);
  if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, "utf8");
  if (src.length > MAX) continue;
  const name = `OZ_${rel.replaceAll("/", "_")}`;
  fs.writeFileSync(path.join(out, name), src);
  items.push({ name, label: "audited", category: "audited", lines: [], source: `https://github.com/OpenZeppelin/openzeppelin-contracts/blob/${commit(oz)}/contracts/${rel}`,
    origin: "OpenZeppelin Contracts v5.1.0", license: "MIT", sha256: sha(src) });
}
fs.writeFileSync(new URL("./manifest.json", import.meta.url), JSON.stringify({ max_chars: MAX, cap: CAP, count: items.length, items }, null, 1) + "\n");
const counts = items.reduce((m, x) => ((m[x.category] = (m[x.category] || 0) + 1), m), {});
console.log(JSON.stringify({ count: items.length, counts, hint: items.filter((x) => x.hint).length }));
