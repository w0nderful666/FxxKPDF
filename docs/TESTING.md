# Testing — FxxKPDF

## Quick Reference

```bash
# Full test suite
npm test                    # = build + self-test + preflight

# Individual checks
npm run build               # Copy files to dist/
npm run self-test           # Structural integrity checks
npm run preflight           # Pre-deployment validation
npm run check:i18n          # i18n key alignment (zh ↔ en)
npm run check:tools         # Tool registry completeness (13 tools)
npm run check:version       # Version consistency across all files
npm run check:privacy       # No file upload or data exfiltration
```

## Script Details

### `npm run build`
Copies all project files to `dist/` directory:
- `index.html`, `app.js`, `styles.css`, `qpdf-utils.js`, `self-test.html`
- `libs/` (vendored dependencies)
- `js/` (v0.3.1 module files)
- `docs/` (documentation)

### `npm run self-test`
Runs structural checks on the project:
- Verifies all required files exist
- Checks HTML structure
- Validates tool panel count
- Checks i18n data attributes

### `npm run preflight`
Pre-deployment validation:
- Verifies dist/ directory exists and is complete
- Checks file sizes are reasonable
- Validates HTML references

### `npm run check:i18n`
Validates i18n system:
- zh and en translation key counts match
- All 13 tool title/desc keys present
- ZIP-related keys present
- Page range keys present

### `npm run check:tools`
Validates tool registry:
- All 13 stable tools have entries
- Each stable tool has a `handlerName`
- Roadmap tools (compress, ocr, batch_watermark) are not in stable list
- `getLegacyArray()` method exists

### `npm run check:version`
Validates version consistency:
- `package.json` version
- `js/siteMeta.js` version
- `index.html` hero badge and footer
- `README.md` mentions current version
- `RELEASE_NOTES.md` mentions current version

### `npm run check:privacy`
Validates privacy guarantees:
- No `fetch()` calls that upload file data
- No `XMLHttpRequest` POST requests
- No `navigator.sendBeacon`
- No PDF content in localStorage
- No data sent to external servers
- `siteMeta.js` contains no sensitive data
- `storage.js` stores metadata only

## Pre-Release Checklist

1. `npm test` passes (build + self-test + preflight)
2. All 4 check scripts pass
3. Manual browser test: open `dist/index.html` or `index.html`
4. Verify all 13 tools load and respond
5. Test language toggle (zh ↔ en)
6. Test dark mode toggle
7. Test at least one tool end-to-end (e.g., merge two PDFs)

## Local Preview

```bash
# Python
python -m http.server 8080

# Node.js
npx serve .

# Then open http://localhost:8080
```
