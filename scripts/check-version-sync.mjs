/**
 * check-version-sync.mjs — Verify version consistency across all files
 * v0.3.1
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
let errors = 0;

function fail(msg) { console.error(`  ✗ ${msg}`); errors++; }
function ok(msg) { console.log(`  ✓ ${msg}`); }

console.log("\n📋 Version Sync Check");

// Read package.json
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = pkg.version;
console.log(`  Expected version: ${version}`);

// Check package.json
if (pkg.version === version) ok(`package.json: ${version}`);
else fail(`package.json version mismatch: ${pkg.version}`);

// Check siteMeta.js
const siteMetaSrc = readFileSync(join(root, "js", "siteMeta.js"), "utf8");
if (siteMetaSrc.includes(`version: "${version}"`)) ok(`js/siteMeta.js: ${version}`);
else fail(`js/siteMeta.js version mismatch (expected ${version})`);

// Check index.html (hero badge)
const html = readFileSync(join(root, "index.html"), "utf8");
if (html.includes(`v${version}`)) ok(`index.html hero badge: v${version}`);
else fail(`index.html hero badge missing v${version}`);

// Check index.html (footer)
if (html.includes(`>v${version}<`) || html.includes(`>v${version}<`)) ok(`index.html footer: v${version}`);
else fail(`index.html footer missing v${version}`);

// Check README.md contains current version
const readme = readFileSync(join(root, "README.md"), "utf8");
if (readme.includes(`v${version}`)) ok(`README.md mentions v${version}`);
else fail(`README.md missing v${version}`);

// Check RELEASE_NOTES.md contains current version
const releaseNotes = readFileSync(join(root, "RELEASE_NOTES.md"), "utf8");
if (releaseNotes.includes(`v${version}`)) ok(`RELEASE_NOTES.md mentions v${version}`);
else fail(`RELEASE_NOTES.md missing v${version}`);

console.log(`\n${errors === 0 ? "✅" : "❌"} Version sync check: ${errors} errors`);
process.exit(errors > 0 ? 1 : 0);
