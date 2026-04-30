import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const files = [
  ["node_modules/pdf-lib/dist/pdf-lib.min.js", "libs/pdf-lib/pdf-lib.min.js"],
  ["node_modules/pdfjs-dist/build/pdf.min.js", "libs/pdfjs/pdf.min.js"],
  ["node_modules/pdfjs-dist/build/pdf.worker.min.js", "libs/pdfjs/pdf.worker.min.js"],
  ["node_modules/sortablejs/Sortable.min.js", "libs/sortable/Sortable.min.js"]
];

for (const [sourcePath, targetPath] of files) {
  const source = resolve(sourcePath);
  const target = resolve(targetPath);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  console.log(`Copied ${source} -> ${target}`);
}
