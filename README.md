# FxxKPDF

Local-first, privacy-first PDF toolkit. All processing happens in your browser — no upload, no backend, no tracking.

🔗 **Online Demo:** <https://w0nderful666.github.io/FxxKPDF/>
📌 **Current Version:** v0.2.1

## Core Features

- 🔒 **100% Local Processing** — Files never leave your browser
- 🚫 **No Upload, No Backend** — Works entirely client-side
- 🌙 **Dark Mode** — Toggle with localStorage persistence
- 🌐 **Chinese / English** — Bilingual interface with language toggle
- 📱 **Mobile Responsive** — Works on phones, tablets, and desktops
- ⚡ **Zero Build Step** — Pure vanilla JS, no bundler required
- 🚀 **GitHub Pages Ready** — One-click deploy via GitHub Actions

## Supported PDF Functions

| Tool | Description |
|------|-------------|
| PDF Merge | Combine multiple PDFs, drag to reorder |
| PDF Split / Extract | Extract pages by range (1-3, 5, 8-10) |
| Page Manager | Reorder, delete, extract, rotate pages |
| Page Numbers | Add page numbers with custom position, font, format |
| Text Watermark | Add text watermark (center, tile, corner) |
| Image Watermark | Add PNG/JPG watermark with opacity control |
| Signature / Stamp | Upload or hand-draw signature, place on page |
| Annotations | Add text, rectangles, circles, lines, images |
| Permission Check | View encryption, print, copy, edit, form, signature permissions |
| Normal Copy | Re-save restricted PDF as normal copy |
| Password Protection | Add open password and permission settings (QPDF WASM) |
| Metadata Cleanup | View, clear, or randomize PDF metadata |
| Image to PDF | Convert JPG/PNG images to PDF with layout options |

## Use Cases

- Merge scanned pages into a single PDF
- Extract specific pages from a report
- Add watermarks to confidential documents
- Sign contracts and forms digitally
- Clean metadata before sharing
- Convert photos to PDF for printing

## Privacy

All PDF processing happens in your browser using JavaScript and WebAssembly. Your files are **never uploaded** to any server. When you refresh the page or close the tab, all loaded files are removed from memory.

This tool does not crack passwords, remove DRM, or bypass PDF protections. It is designed for files you own or have authorization to process.

## Local Run

```bash
# Clone the repository
git clone https://github.com/w0nderful666/FxxKPDF.git
cd FxxKPDF

# Install dependencies (for vendor scripts only)
npm install

# Start a local server
python -m http.server 8080
# Then open http://localhost:8080
```

## Deploy to GitHub Pages

1. Fork this repository
2. Go to **Settings → Pages → Source → GitHub Actions**
3. Push to `main` — the workflow will build and deploy automatically
4. Your site will be live at `https://<username>.github.io/FxxKPDF/`

## Tech Stack

- **Vanilla JavaScript** — No framework, no build step
- **pdf-lib** — PDF creation and modification
- **PDF.js** — PDF rendering and preview
- **SortableJS** — Drag-and-drop reordering
- **QPDF WASM** — PDF encryption and deep rewrite
- **GitHub Actions** — CI/CD and Pages deployment

## Project Structure

```
FxxKPDF/
├── index.html          # Main page with all tool panels
├── app.js              # All PDF tool logic + i18n + settings
├── styles.css          # All styling (light + dark mode)
├── qpdf-utils.js       # QPDF WebAssembly adapter
├── self-test.html      # Browser-based self-test page
├── libs/               # Vendored dependencies
│   ├── pdf-lib/
│   ├── pdfjs/
│   ├── sortable/
│   └── qpdf-wasm/
├── scripts/
│   ├── build.mjs       # Build script (copies to dist/)
│   ├── run-self-test.mjs  # Node.js self-test
│   ├── preflight.mjs   # Pre-deploy checks
│   ├── vendor-libs.mjs # Download vendored libs
│   └── vendor-qpdf.mjs # Download QPDF WASM
├── .github/workflows/
│   └── pages.yml       # GitHub Pages deployment
├── package.json
├── LICENSE             # MIT
├── README.md
└── RELEASE_NOTES.md
```

## Self-Test Commands

```bash
npm run build        # Copy files to dist/
npm run self-test    # Run structural checks
npm run preflight    # Run pre-deploy validation
```

## Roadmap

- 📦 PDF Compression
- 🔍 OCR (Optical Character Recognition)
- 🖊️ Batch Watermark
- 📄 PDF/A Conversion
- 📊 PDF Form Filling

## License

[MIT](LICENSE)
