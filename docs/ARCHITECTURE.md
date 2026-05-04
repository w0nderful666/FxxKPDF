# Architecture — FxxKPDF

## Overview

FxxKPDF is a vanilla JavaScript single-page application (SPA) for PDF processing. It runs entirely in the browser with no server-side component.

## Why Vanilla JS (Not React)

1. **Zero build step** — Works directly from static files, no bundler needed
2. **GitHub Pages ready** — Deploy by pushing to `main`, no build pipeline required
3. **Minimal dependencies** — Only PDF-specific libs (pdf-lib, PDF.js, QPDF WASM)
4. **Fast load** — No framework overhead, no virtual DOM, no hydration
5. **Easy to audit** — All code is readable plain JavaScript, no transpilation

### Future React Migration

If a React migration is desired in the future, it should:
- Live on a separate branch (e.g., `react-migration`)
- Use Vite or similar for build
- Preserve all 13 tool functionalities
- Maintain the same privacy guarantees
- Not be merged into `main` until fully complete and tested

## Module Structure (v0.3.1)

```
js/
├── siteMeta.js       — Single source of truth for project metadata
├── i18n.js           — Centralized translation management (zh/en)
├── storage.js        — Unified localStorage wrapper
├── toolRegistry.js   — Central registry for all PDF tools
├── rangeParser.js    — Page range parsing with i18n error messages
├── zipUtils.js       — ZIP file creation and download
└── fileUtils.js      — Common file and UI utility functions
```

### Module Responsibilities

| Module | Window Global | Responsibility |
|--------|--------------|----------------|
| `siteMeta.js` | `window.siteMeta` | App name, version, URLs, storage keys |
| `i18n.js` | `window.i18n` | Translation strings (zh/en), `t()` function, language state |
| `storage.js` | `window.storage` | `getSettings`, `saveSettings`, `addRecentOperation`, `exportSettings`, `importSettings` |
| `toolRegistry.js` | `window.toolRegistry` | Tool list (13 stable + 3 roadmap), metadata, `getLegacyArray()` |
| `rangeParser.js` | `window.rangeParser` | `parsePageRange`, `parsePageRangeDetailed`, `parsePageRanges`, `summarizePages` |
| `zipUtils.js` | `window.zipUtils` | `getZipFileName`, `downloadAsZip`, `showZipResult` |
| `fileUtils.js` | `window.appUI` | `escapeHTML`, `sanitizeFileName`, `buildOutputName`, `formatSize`, `showAlert`, `friendlyError`, `setBusy`, `warnLargeFiles`, `bytesFromFile`, `showConfirm` |

### Load Order

Scripts must load in dependency order:
1. `siteMeta.js` (no dependencies)
2. `i18n.js` (depends on siteMeta for storage keys)
3. `storage.js` (depends on siteMeta, i18n)
4. `toolRegistry.js` (no module dependencies)
5. `rangeParser.js` (depends on i18n)
6. `zipUtils.js` (depends on i18n, appUI optional)
7. `fileUtils.js` (no module dependencies)
8. `app.js` (depends on all above)

## Key Design Decisions

### IIFE Pattern
All modules use the IIFE (Immediately Invoked Function Expression) pattern to avoid polluting the global scope while exposing a single namespace on `window`.

### Backward Compatibility
`app.js` retains its existing function signatures and behavior. Module extraction changes _where_ code lives, not _what_ it does. Functions like `parsePageRange()` in app.js are thin wrappers that delegate to `window.rangeParser.parsePageRange()`.

### CSP (Content Security Policy)
The application uses a strict CSP that:
- Blocks external script loading
- Blocks external network requests (`connect-src 'self'`)
- Allows `wasm-unsafe-eval` for QPDF WASM
- Allows `blob:` for worker and image processing
