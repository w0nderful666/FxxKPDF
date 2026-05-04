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
check("package.json version is 0.3.1", pkg.version === "0.3.1");
check("package.json has license", pkg.license === "MIT");
check("package.json has repository", /github\.com\/w0nderful666\/FxxKPDF/.test(pkg.repository?.url || ""));
check("package.json has homepage", /w0nderful666\.github\.io\/FxxKPDF/.test(pkg.homepage || ""));
check("package.json has keywords", Array.isArray(pkg.keywords) && pkg.keywords.length >= 4);
check("package.json has check:i18n script", /check:i18n/.test(JSON.stringify(pkg.scripts)));
check("package.json has check:tools script", /check:tools/.test(JSON.stringify(pkg.scripts)));
check("package.json has check:version script", /check:version/.test(JSON.stringify(pkg.scripts)));
check("package.json has check:privacy script", /check:privacy/.test(JSON.stringify(pkg.scripts)));
check("package.json has test script", /"test":\s*"npm run build/.test(JSON.stringify(pkg.scripts)));

// --- README.md ---
if (existsSync(join(root, "README.md"))) {
  const readme = readFileSync(join(root, "README.md"), "utf-8");
  check("README contains online URL", /w0nderful666\.github\.io\/FxxKPDF/.test(readme));
  check("README contains privacy info", /隐私|privacy|local|本地/i.test(readme));
  check("README contains local run instructions", /python.*http\.server|localhost/i.test(readme));
  check("README contains deploy instructions", /GitHub Pages|deploy|部署/i.test(readme));
  check("README contains tech stack info", /pdf-lib|PDF\.js|QPDF/i.test(readme));
  check("README contains ZIP download info", /ZIP|zip/i.test(readme));
  check("README contains page range syntax info", /all.*odd.*even|页面范围|Page Range/i.test(readme));
  check("README mentions JSZip", /JSZip|jszip/i.test(readme));
  check("README contains v0.3.1", /v0\.3\.1/.test(readme));
  check("README mentions docs/", /docs\//.test(readme));
  check("README mentions check commands", /check:i18n|check:tools|check:version|check:privacy/.test(readme));
} else {
  check("README.md exists", false);
}

// --- RELEASE_NOTES.md ---
if (existsSync(join(root, "RELEASE_NOTES.md"))) {
  const notes = readFileSync(join(root, "RELEASE_NOTES.md"), "utf-8");
  check("RELEASE_NOTES contains v0.3.1", /v0\.3\.1/.test(notes));
  check("RELEASE_NOTES contains v0.3.0", /v0\.3\.0/.test(notes));
  check("RELEASE_NOTES mentions ZIP download", /ZIP|zip/i.test(notes));
  check("RELEASE_NOTES mentions page range", /page range|页面范围/i.test(notes));
  check("RELEASE_NOTES mentions siteMeta", /siteMeta/i.test(notes));
  check("RELEASE_NOTES mentions toolRegistry", /toolRegistry/i.test(notes));
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

// --- JSZip vendored ---
check("JSZip library vendored", existsSync(join(root, "libs/jszip/jszip.min.js")));

// --- Build output check ---
const distExists = existsSync(join(root, "dist", "index.html"));
check("Build output (dist/index.html) can be generated", distExists);

// --- v0.3.1: i18n in separate module ---
const i18nSrc = readFileSync(join(root, "js", "i18n.js"), "utf-8");
check("js/i18n.js has i18n system", /var I18N/.test(i18nSrc));
check("js/i18n.js has Chinese translations", /zh:\s*\{/.test(i18nSrc));
check("js/i18n.js has English translations", /en:\s*\{/.test(i18nSrc));

// --- v0.3.1: app.js delegates ---
const appJs = readFileSync(join(root, "app.js"), "utf-8");
check("app.js delegates i18n to window.i18n", /window\.i18n\.t/.test(appJs) || /window\.i18n/.test(appJs));
check("app.js delegates storage to window.storage", /window\.storage/.test(appJs));
check("app.js uses toolRegistry", /window\.toolRegistry/.test(appJs));

// --- v0.3.0: ZIP and page range still present (via delegation) ---
check("app.js has ZIP download logic", /downloadAsZip/.test(appJs));
check("app.js has page range parsing", /parsePageRanges/.test(appJs));

// --- i18n has ZIP-related keys ---
check("js/i18n.js i18n has ZIP-related keys", /zip_download.*ZIP/i.test(i18nSrc));
check("js/i18n.js i18n has page range keys", /page_range.*页面范围/i.test(i18nSrc));

console.log(`\nPreflight: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
