# Privacy Model — FxxKPDF

## Core Principle

**Your files never leave your browser.**

All PDF processing happens entirely client-side using JavaScript (pdf-lib, PDF.js) and WebAssembly (QPDF). No file content is ever uploaded to any server.

## What Happens to Your Files

1. **Upload**: Files are read into browser memory via `File API`
2. **Processing**: All operations (merge, split, watermark, etc.) happen in-browser
3. **Download**: Processed files are offered as local downloads via `Blob` URLs
4. **Cleanup**: Files are removed from memory when you refresh, close the tab, or click "Clear"

## What Is Stored Locally

`localStorage` stores **only metadata**, never file content:

| Key | Content |
|-----|---------|
| `fxxkpdf-settings` | Theme, language, last active tool |
| `fxxkpdf-lang` | UI language preference (zh/en) |
| `pdf-toolkit-theme` | Dark/light mode |
| `pdf-toolkit-wide` | Wide layout toggle |
| `pdf-toolkit-compact` | Compact layout toggle |

### Recent Operations History

The settings object may contain a `recent` array with up to 10 entries, each storing:
- Tool name (localized)
- Output filename
- Timestamp
- File size (number only)
- Input/output file counts
- ZIP download flag
- Page range used

**No PDF content, page data, or file bytes are ever stored.**

## Content Security Policy

The HTML includes a strict CSP:

```
default-src 'self';
base-uri 'self';
object-src 'none';
img-src 'self' blob: data:;
worker-src 'self' blob:;
script-src 'self' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline';
connect-src 'self';
```

Key restrictions:
- `connect-src 'self'` — No network requests to external servers
- `script-src 'self'` — No inline scripts or external script loading
- `object-src 'none'` — No plugins

## What This Tool Does NOT Do

- ❌ Does not upload files to any server
- ❌ Does not send file content via `fetch`, `XMLHttpRequest`, or `sendBeacon`
- ❌ Does not store PDF content in `localStorage` or `IndexedDB`
- ❌ Does not track users or collect analytics
- ❌ Does not use cookies for tracking
- ❌ Does not crack passwords or bypass DRM
- ❌ Does not read files without user action (no auto-scan)
