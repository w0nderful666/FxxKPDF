/**
 * check-i18n.mjs — Verify i18n key alignment between zh and en
 * v0.3.1
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
let errors = 0;
let warnings = 0;

function fail(msg) { console.error(`  ✗ ${msg}`); errors++; }
function warn(msg) { console.warn(`  ⚠ ${msg}`); warnings++; }
function ok(msg) { console.log(`  ✓ ${msg}`); }

// Read i18n.js
const i18nSrc = readFileSync(join(root, "js", "i18n.js"), "utf8");

// Extract I18N object by evaluating in a sandboxed way
// We'll parse the keys by finding the zh and en blocks
function extractKeys(lang) {
  // Find the lang block and extract key names
  const regex = new RegExp(lang + ":\\s*\\{([\\s\\S]*?)\\n\\s*\\}", "m");
  const match = i18nSrc.match(regex);
  if (!match) return [];
  const block = match[1];
  // Match lines like: key_name: "value" — only actual key-value pairs (value starts with quote)
  const keyRegex = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*["'`]/gm;
  const keys = [];
  let m;
  while ((m = keyRegex.exec(block)) !== null) {
    keys.push(m[1]);
  }
  return keys;
}

const zhKeys = extractKeys("zh");
const enKeys = extractKeys("en");

console.log("\n📋 i18n Key Alignment Check");
console.log(`  zh keys: ${zhKeys.length}`);
console.log(`  en keys: ${enKeys.length}`);

// Check alignment
const zhSet = new Set(zhKeys);
const enSet = new Set(enKeys);

const missingInEn = zhKeys.filter((k) => !enSet.has(k));
const missingInZh = enKeys.filter((k) => !zhSet.has(k));

if (missingInEn.length) {
  fail(`Keys in zh but missing from en: ${missingInEn.join(", ")}`);
}
if (missingInZh.length) {
  fail(`Keys in en but missing from zh: ${missingInZh.join(", ")}`);
}
if (!missingInEn.length && !missingInZh.length) {
  ok("zh and en keys are aligned");
}

// Check ZIP-related keys
const zipKeys = ["zip_download", "zip_generating", "zip_download_failed", "zip_ready"];
for (const key of zipKeys) {
  if (zhSet.has(key) && enSet.has(key)) ok(`ZIP key present: ${key}`);
  else fail(`Missing ZIP key: ${key}`);
}

// Check page range keys
const rangeKeys = ["page_range", "page_range_all", "page_range_odd", "page_range_even", "page_range_example", "invalid_page_number", "page_out_of_range"];
for (const key of rangeKeys) {
  if (zhSet.has(key) && enSet.has(key)) ok(`Range key present: ${key}`);
  else fail(`Missing range key: ${key}`);
}

// Check all 13 tool keys
const toolIds = ["merge", "split", "manage", "number", "textwatermark", "imagewatermark", "signature", "annotate", "permissions", "normalcopy", "protect", "metadata", "imagepdf"];
for (const id of toolIds) {
  const titleKey = `tool_${id}`;
  const descKey = `tool_${id}_desc`;
  if (zhSet.has(titleKey) && enSet.has(titleKey)) ok(`Tool title key: ${titleKey}`);
  else fail(`Missing tool title key: ${titleKey}`);
  if (zhSet.has(descKey) && enSet.has(descKey)) ok(`Tool desc key: ${descKey}`);
  else fail(`Missing tool desc key: ${descKey}`);
}

console.log(`\n${errors === 0 ? "✅" : "❌"} i18n check: ${errors} errors, ${warnings} warnings`);
process.exit(errors > 0 ? 1 : 0);
