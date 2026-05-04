import { mkdirSync, cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const dist = join(root, "dist");

// Clean dist/
if (existsSync(dist)) {
  rmSync(dist, { recursive: true });
}
mkdirSync(dist, { recursive: true });

// Copy files
const files = ["index.html", "app.js", "styles.css", "qpdf-utils.js", "self-test.html"];
for (const file of files) {
  const src = join(root, file);
  if (existsSync(src)) {
    cpSync(src, join(dist, file));
    console.log(`  ✓ ${file}`);
  }
}

// Copy libs/
const libsSrc = join(root, "libs");
if (existsSync(libsSrc)) {
  cpSync(libsSrc, join(dist, "libs"), { recursive: true });
  console.log("  ✓ libs/");
}

console.log("\n✅ Build complete → dist/");
