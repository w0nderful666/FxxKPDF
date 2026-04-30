import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const source = resolve("node_modules/qpdf-wasm-esm-embedded/qpdf.mjs");
const target = resolve("libs/qpdf/qpdf.mjs");

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`Copied ${source} -> ${target}`);
