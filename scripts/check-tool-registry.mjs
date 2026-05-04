/**
 * check-tool-registry.mjs — Verify tool registry completeness
 * v0.3.1
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
let errors = 0;

function fail(msg) { console.error(`  ✗ ${msg}`); errors++; }
function ok(msg) { console.log(`  ✓ ${msg}`); }

const src = readFileSync(join(root, "js", "toolRegistry.js"), "utf8");

// Expected 13 stable tools
const expectedTools = [
  "merge", "split", "manage", "number", "textwatermark",
  "imagewatermark", "signature", "annotate", "permissions",
  "normalcopy", "protect", "metadata", "imagepdf"
];

console.log("\n📋 Tool Registry Check");

// Check each tool exists in the source
for (const id of expectedTools) {
  const pattern = new RegExp(`id:\\s*"${id}"`);
  if (pattern.test(src)) ok(`Tool entry found: ${id}`);
  else fail(`Missing tool entry: ${id}`);
}

// Check stable tools have handlerName
const stablePattern = /id:\s*"([^"]+)"[^}]*status:\s*"stable"[^}]*handlerName:\s*"([^"]+)"/g;
let stableCount = 0;
let match;
while ((match = stablePattern.exec(src)) !== null) {
  stableCount++;
  if (match[2]) ok(`Stable tool ${match[1]} has handlerName: ${match[2]}`);
  else fail(`Stable tool ${match[1]} missing handlerName`);
}
if (stableCount !== 13) fail(`Expected 13 stable tools, found ${stableCount}`);
else ok(`All 13 stable tools have handlerName`);

// Check roadmap tools are NOT in stable list
const roadmapTools = ["compress", "ocr", "batch_watermark"];
for (const id of roadmapTools) {
  // Check it appears in ROADMAP but not in TOOLS as stable
  const inRoadmap = new RegExp(`id:\\s*"${id}"[^}]*status:\\s*"roadmap"`).test(src);
  const inStable = new RegExp(`id:\\s*"${id}"[^}]*status:\\s*"stable"`).test(src);
  if (inRoadmap) ok(`Roadmap tool found: ${id}`);
  else fail(`Roadmap tool missing: ${id}`);
  if (!inStable) ok(`Roadmap tool ${id} not in stable list`);
  else fail(`Roadmap tool ${id} incorrectly in stable list`);
}

// Check getLegacyArray exists
if (/getLegacyArray/.test(src)) ok("getLegacyArray method present");
else fail("getLegacyArray method missing");

console.log(`\n${errors === 0 ? "✅" : "❌"} Tool registry check: ${errors} errors`);
process.exit(errors > 0 ? 1 : 0);
