# Quality Bar — FxxKPDF

## Core Principles

### Local First
All PDF processing happens entirely in the browser using JavaScript and WebAssembly. No server-side processing.

### No Backend
No API calls, no databases, no server-side computation. The application is a static site.

### GitHub Pages Ready
Deployable as a static site on GitHub Pages with zero server configuration.

### No Fake Buttons
Every tool button must perform a real, functional operation. "Coming Soon" features are clearly marked in the Roadmap section with distinct styling — they never appear as clickable tool cards.

## Tool Status Boundaries

### Stable Tools (13)
Tools that are fully functional and tested:
1. PDF Merge
2. PDF Split / Extract
3. Page Manager
4. Page Numbers
5. Text Watermark
6. Image Watermark
7. Signature / Stamp
8. Annotations
9. Permission Check
10. Normal Copy
11. Password Protection
12. Metadata Cleanup
13. Image to PDF

### Roadmap Tools
Tools that are planned but not yet implemented:
- PDF Compression
- OCR Text Recognition
- Batch Watermark

These appear only in the Roadmap section, never as functional tool cards.

## Testing Requirements

Every release must pass:
1. `npm run build` — Clean build to dist/
2. `npm run self-test` — Structural integrity checks
3. `npm run preflight` — Pre-deployment validation
4. `npm run check:i18n` — i18n key alignment (zh ↔ en)
5. `npm run check:tools` — Tool registry completeness
6. `npm run check:version` — Version consistency across files
7. `npm run check:privacy` — No file upload or data exfiltration

## Privacy Requirements

- No file content sent to any server
- No PDF content stored in localStorage
- localStorage only stores: settings, language preference, theme, recent operation metadata
- CSP headers restrict connect-src to 'self'
