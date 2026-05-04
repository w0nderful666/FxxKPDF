import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
let passed = 0;
let failed = 0;

function check(name, ok) {
  if (ok) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.error(`  ❌ ${name}`); }
}

console.log("Running self-test…\n");

// --- package.json ---
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
check("package.json version is 0.2.0", pkg.version === "0.2.0");

// --- README.md ---
check("README.md exists", existsSync(join(root, "README.md")));

// --- RELEASE_NOTES.md ---
check("RELEASE_NOTES.md exists", existsSync(join(root, "RELEASE_NOTES.md")));

// --- index.html checks ---
const html = readFileSync(join(root, "index.html"), "utf-8");
check("index.html has title", /FxxKPDF/.test(html));
check("index.html has hero section", /data-testid="hero"/.test(html));
check("index.html has upload area", /data-testid="upload-area"/.test(html) || /dropzone/.test(html));
check("index.html has tool grid", /id="toolGrid"/.test(html));
check("index.html has privacy section", /data-testid="privacy-section"/.test(html));
check("index.html has dark mode button", /id="themeToggle"/.test(html));
check("index.html has language toggle", /id="langBtn"/.test(html));
check("index.html has v0.2.0", /v0\.2\.0/.test(html));
check("index.html footer has 'Local First'", /Local First/.test(html));
check("index.html footer has 'No Backend'", /No Backend/.test(html));
check("index.html footer has 'GitHub Pages Ready'", /GitHub Pages Ready/.test(html));

console.log(`\nSelf-test: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
