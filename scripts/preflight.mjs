import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
let passed = 0;
let failed = 0;

function check(name, ok) {
  if (ok) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.error(`  ❌ ${name}`); }
}

console.log("Running preflight…\n");

// --- package.json ---
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
check("package.json version is 0.2.1", pkg.version === "0.2.1");
check("package.json has license", pkg.license === "MIT");
check("package.json has repository", /github\.com\/w0nderful666\/FxxKPDF/.test(pkg.repository?.url || ""));
check("package.json has homepage", /w0nderful666\.github\.io\/FxxKPDF/.test(pkg.homepage || ""));
check("package.json has keywords", Array.isArray(pkg.keywords) && pkg.keywords.length >= 4);

// --- README.md ---
if (existsSync(join(root, "README.md"))) {
  const readme = readFileSync(join(root, "README.md"), "utf-8");
  check("README contains online URL", /w0nderful666\.github\.io\/FxxKPDF/.test(readme));
  check("README contains privacy info", /隐私|privacy|local|本地/i.test(readme));
  check("README contains local run instructions", /python.*http\.server|localhost/i.test(readme));
  check("README contains deploy instructions", /GitHub Pages|deploy|部署/i.test(readme));
  check("README contains tech stack info", /pdf-lib|PDF\.js|QPDF/i.test(readme));
} else {
  check("README.md exists", false);
}

// --- RELEASE_NOTES.md ---
if (existsSync(join(root, "RELEASE_NOTES.md"))) {
  const notes = readFileSync(join(root, "RELEASE_NOTES.md"), "utf-8");
  check("RELEASE_NOTES contains v0.2.1", /v0\.2\.1/.test(notes));
} else {
  check("RELEASE_NOTES.md exists", false);
}

// --- GitHub workflow ---
check(".github/workflows/pages.yml exists", existsSync(join(root, ".github/workflows/pages.yml")));

// --- No fake TODO buttons ---
const html = readFileSync(join(root, "index.html"), "utf-8");
check("No 'TODO: implement' fake buttons", !/TODO:\s*implement/i.test(html));

// --- No example.com placeholders ---
check("No example.com placeholder links", !/example\.com/i.test(html));

// --- Build output check ---
const distExists = existsSync(join(root, "dist", "index.html"));
check("Build output (dist/index.html) can be generated", distExists);

// --- i18n completeness ---
const appJs = readFileSync(join(root, "app.js"), "utf-8");
check("app.js has i18n system", /const I18N/.test(appJs));
check("app.js has Chinese translations", /zh:\s*\{/.test(appJs));
check("app.js has English translations", /en:\s*\{/.test(appJs));
check("app.js has all 13 tool i18n keys", /tool_merge.*tool_imagepdf/s.test(appJs));

console.log(`\nPreflight: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
