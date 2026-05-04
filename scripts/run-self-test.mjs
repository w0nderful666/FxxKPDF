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
check("package.json version is 0.3.0", pkg.version === "0.3.0");

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
check("index.html has v0.3.0", /v0\.3\.0/.test(html));
check("index.html footer has 'Local First'", /Local First/.test(html));
check("index.html footer has 'No Backend'", /No Backend/.test(html));
check("index.html footer has 'GitHub Pages Ready'", /GitHub Pages Ready/.test(html));

// --- v0.3.0: ZIP download related ---
const appJs = readFileSync(join(root, "app.js"), "utf-8");
check("app.js has ZIP download logic (JSZip)", /JSZip/.test(appJs));
check("app.js has downloadAsZip function", /function downloadAsZip/.test(appJs));
check("app.js has showZipResult function", /function showZipResult/.test(appJs));

// --- v0.3.0: Page range parser ---
check("app.js has parsePageRanges function", /function parsePageRanges/.test(appJs));
check("app.js supports 'all' keyword", /['"](all)['"]/.test(appJs));
check("app.js supports 'odd' keyword", /['"](odd)['"]/.test(appJs));
check("app.js supports 'even' keyword", /['"](even)['"]/.test(appJs));

// --- v0.3.0: Page range help text in HTML ---
check("HTML has page range help text", /支持.*all.*odd.*even/i.test(html) || /supports.*all.*odd.*even/i.test(html));

// --- v0.3.0: i18n entries ---
check("app.js i18n has zip_download", /zip_download/.test(appJs));
check("app.js i18n has page_range", /page_range/.test(appJs));
check("app.js i18n has split_perpage", /split_perpage/.test(appJs));
check("app.js i18n has delete_pages", /delete_pages/.test(appJs));

// --- v0.3.0: Enhanced recent records ---
check("app.js recent records has toolName field", /toolName/.test(appJs));
check("app.js recent records has inputCount field", /inputCount/.test(appJs));
check("app.js recent records has outputCount field", /outputCount/.test(appJs));
check("app.js recent records has isZip field", /isZip/.test(appJs));
check("app.js recent records has pageRange field", /pageRange/.test(appJs));

// --- 13 tool panels exist ---
const toolPanels = [
  "panel-merge", "panel-split", "panel-manage", "panel-number",
  "panel-textwatermark", "panel-imagewatermark", "panel-signature",
  "panel-annotate", "panel-permissions", "panel-normalcopy",
  "panel-protect", "panel-metadata", "panel-imagepdf"
];
for (const panelId of toolPanels) {
  check(`index.html has ${panelId}`, html.includes(`id="${panelId}"`));
}

// --- Roadmap is not fake ---
check("Roadmap section exists", /data-testid="roadmap-section"/.test(html));
check("Roadmap has Coming Soon markers", /Coming Soon/.test(html));

// --- Roadmap does NOT mark compression/OCR as implemented ---
check("Roadmap does not mark PDF compression as implemented", !/✅.*PDF 压缩|✅.*PDF Compression/.test(html));
check("Roadmap does not mark OCR as implemented", !/✅.*OCR/.test(html));

// --- i18n data-i18n attributes present ---
check("index.html has data-i18n attributes", /data-i18n=/.test(html));

// --- Supported format text in dropzones ---
check("Upload area mentions PDF", /application\/pdf/.test(html));
check("Upload area mentions image", /image\/png,image\/jpeg/.test(html));

// --- Privacy text present ---
check("Privacy section mentions No Upload", html.includes("No Upload") || html.includes("不上传"));
check("Privacy section mentions Local First", html.includes("Local First") || html.includes("本地处理"));

// --- JSZip script tag in HTML ---
check("index.html loads JSZip script", /jszip\.min\.js/.test(html));

// --- Split mode select exists ---
check("index.html has split mode selector", /id="splitMode"/.test(html));

// --- Manage range input exists ---
check("index.html has manage range input", /id="manageRange"/.test(html));
check("index.html has manageDeleteRangeBtn", /id="manageDeleteRangeBtn"/.test(html));
check("index.html has manageKeepRangeBtn", /id="manageKeepRangeBtn"/.test(html));

console.log(`\nSelf-test: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
