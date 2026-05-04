/**
 * check-privacy.mjs — Verify no file upload or data exfiltration code
 * v0.3.1
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
let errors = 0;
let warnings = 0;

function fail(msg) { console.error(`  ✗ ${msg}`); errors++; }
function warn(msg) { console.warn(`  ⚠ ${msg}`); warnings++; }
function ok(msg) { console.log(`  ✓ ${msg}`); }

console.log("\n📋 Privacy Check");

// Collect files to scan
const filesToScan = [];

// app.js
filesToScan.push(join(root, "app.js"));

// js/ directory
const jsDir = join(root, "js");
try {
  for (const f of readdirSync(jsDir)) {
    if (f.endsWith(".js")) filesToScan.push(join(jsDir, f));
  }
} catch (_e) { /* ignore */ }

const violations = [];

for (const filePath of filesToScan) {
  const relPath = filePath.replace(root + "/", "");
  let src;
  try {
    src = readFileSync(filePath, "utf8");
  } catch (_e) { continue; }

  // Check for fetch() calls that might upload files
  // Allow fetch for loading local resources (like qpdf wasm)
  const fetchMatches = src.match(/fetch\s*\(/g);
  if (fetchMatches) {
    // Check if fetch is used with file data
    if (/fetch\s*\([^)]*(?:file|blob|data|body|upload)/i.test(src)) {
      fail(`${relPath}: fetch() may upload file data`);
    } else {
      // Likely loading local resources (qpdf wasm etc)
      warn(`${relPath}: fetch() found (${fetchMatches.length} calls) — verify these are local resource loads only`);
    }
  }

  // Check for XMLHttpRequest
  if (/XMLHttpRequest|new\s+XHR|\.open\s*\(\s*["']POST/i.test(src)) {
    fail(`${relPath}: XMLHttpRequest/POST found — potential data upload`);
  }

  // Check for navigator.sendBeacon
  if (/navigator\.sendBeacon/i.test(src)) {
    fail(`${relPath}: navigator.sendBeacon found — potential data exfiltration`);
  }

  // Check for storing PDF content in localStorage
  // Note: "fxxkpdf-settings" key name contains "pdf" but stores metadata only
  // Look for actual PDF content storage patterns
  if (/localStorage.*(?:document\.content|file\.data|blob|base64|data:application\/pdf)/i.test(src)) {
    fail(`${relPath}: may store PDF content in localStorage`);
  }

  // Check for sending data to external servers
  // Look for URLs that are not github.io (self)
  const urlMatches = src.match(/https?:\/\/[^\s"'`]+/g);
  if (urlMatches) {
    for (const url of urlMatches) {
      if (url.includes("github.io") || url.includes("github.com") || url.includes("localhost")) continue;
      if (url.includes("cdn.jsdelivr.net") || url.includes("unpkg.com") || url.includes("cdnjs.cloudflare.com")) {
        warn(`${relPath}: external CDN URL found: ${url} — verify no data sent`);
      } else {
        warn(`${relPath}: external URL found: ${url}`);
      }
    }
  }

  ok(`${relPath}: scanned`);
}

// Verify siteMeta doesn't expose sensitive info
const siteMetaSrc = readFileSync(join(root, "js", "siteMeta.js"), "utf8");
if (/apiKey|token|secret|password/i.test(siteMetaSrc)) {
  fail("js/siteMeta.js contains sensitive keywords");
} else {
  ok("js/siteMeta.js: no sensitive data");
}

// Verify storage.js doesn't store file contents
const storageSrc = readFileSync(join(root, "js", "storage.js"), "utf8");
if (storageSrc.includes("addRecentOperation") && !/pdf|blob|content|base64/i.test(storageSrc.split("addRecentOperation")[1]?.split("}")[0] || "")) {
  ok("js/storage.js: addRecentOperation stores metadata only");
} else {
  warn("js/storage.js: verify addRecentOperation stores metadata only, not file contents");
}

console.log(`\n${errors === 0 ? "✅" : "❌"} Privacy check: ${errors} errors, ${warnings} warnings`);
process.exit(errors > 0 ? 1 : 0);
