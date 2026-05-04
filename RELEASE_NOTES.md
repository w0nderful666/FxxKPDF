# Release Notes

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
