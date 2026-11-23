import fs from "node:fs";
import { config } from "./config.mjs";
export function readLedger() {
  if (!fs.existsSync(config.ledgerPath)) return [];
  return fs.readFileSync(config.ledgerPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}
export function append(entry) {
  fs.appendFileSync(config.ledgerPath, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n");
}
export function spentToday() {
  const day = new Date().toISOString().slice(0, 10);
  // Purchases, plus signed requests that failed but may have been charged (issue #228): the cap counts the worst case.
  return readLedger().filter((e) => e.ts.startsWith(day) && (e.kind === "purchase" || (e.kind === "error" && e.signed)))
    .reduce((s, e) => s + (e.kind === "purchase" ? e.amount_uusdc || 0 : e.charged_uusdc || 0), 0);
}
