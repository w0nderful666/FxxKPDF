# Release Notes

## v0.3.0

Feature release: Batch ZIP download, enhanced page range parser, split/extract improvements (May 2026).

Added:
- **Batch ZIP Download**: Multiple output files can be downloaded as a single ZIP archive (JSZip)
  - ZIP filename format: `FxxKPDF-results-YYYY-MM-DD.zip`
  - Clear filenames inside ZIP: `split-page-1.pdf`, `split-page-2.pdf`, etc.
  - Shows "Download all as ZIP" button for multi-file outputs
  - Prevents duplicate clicks, shows progress, bilingual error messages
- **Enhanced Page Range Parser** (`parsePageRanges`):
  - Supports: `1` | `1,3,5` | `1-5` | `1,3,5-8,10` | `all` | `odd` | `even`
  - 1-indexed pages, auto-deduplication, out-of-range error messages
  - Bilingual (zh/en) error messages
- **Enhanced Split / Extract**:
  - Three modes: "Extract range as single PDF", "Split each page into separate PDF", "Split by ranges into multiple PDFs"
  - Per-page and range-based splits produce ZIP output
  - Shows estimated output count
  - Presets now use `all`/`odd`/`even` keywords
- **Enhanced Page Manager**:
  - Range input field for page range syntax (`1-3,8,10`, `all`, `odd`, `even`)
  - "Delete specified pages" button (range-based)
  - "Keep specified pages" button (range-based, removes all other pages)
  - Existing click-to-select, all/none/invert/odd/even buttons preserved
- **Enhanced Recent Operations**:
  - New fields: tool name (localized), input file count, output file count, ZIP download flag, page range
  - History increased from 5 to 10 entries
  - Only stores metadata, never file contents
- **i18n Additions**:
  - ZIP download, ZIP generating, ZIP failed, page range, all/odd/even, invalid page, out of range, output count, selection summary, split modes, delete/extract/keep pages
  - All new UI text has Chinese and English translations

Changed:
- Version bumped to v0.3.0 across package.json, footer, README, RELEASE_NOTES
- JSZip vendored at `libs/jszip/jszip.min.js`
- Split panel UI reorganized with mode selector
- Page Manager panel enhanced with range input and new buttons

Preserved:
- All 13 PDF tools unchanged in functionality
- All existing page range syntax still works
- All existing i18n keys preserved
- No breaking changes

## v0.2.1

Experience polish release (May 2026).

Changed:
- Unified all 13 tool names and descriptions into i18n system (zh/en)
- Language toggle now visible on mobile (375px+)
- Tool card text, active tool title/desc update on language switch
- Error messages for missing files, wrong format, consent, password added to i18n
- Success messages (merge, split, export, watermark, signature, etc.) added to i18n
- Settings import/export messages added to i18n
- Version bumped to v0.2.1 across package.json, footer, README, RELEASE_NOTES

Fixed:
- Mobile layout no longer hides language toggle button
- Tool descriptions now translate when switching language
- Active tool header updates on language switch

Preserved:
- All 13 PDF tools unchanged
- All existing functionality intact
- No breaking changes

## v0.2.0

UI & Brand Upgrade release (May 2026).

Added:
- Hero section with Local First / No Upload / No Backend / GitHub Pages Ready badges
- 3-step user guide (Upload → Process → Download)
- Card-based privacy explanation section
- Roadmap section with Coming Soon features
- Dark mode with localStorage persistence
- Chinese/English language toggle with localStorage persistence
- Recent operations history (last 5, metadata only)
- Settings import/export (JSON)
- Share link support (URL params for theme/lang/tool)
- self-test and preflight scripts
- GitHub Pages deployment workflow
- Version v0.2.0 unified across package.json, footer, README, RELEASE_NOTES

Changed:
- Updated Hero branding to FxxKPDF
- Enhanced mobile responsive layout
- Improved footer with version and tech badges

Preserved:
- All 13 existing PDF tools (merge, split, manage, number, text watermark, image watermark, signature, annotate, permissions, normal copy, protect, metadata, image to PDF)
- All existing PDF processing logic
- QPDF WebAssembly integration
- Privacy-first design (no upload, no backend)
