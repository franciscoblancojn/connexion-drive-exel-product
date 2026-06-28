# Changelog

All notable changes to **Connexion Drive Excel Product** are documented here.

---

## [1.1.46] - 2026-06-27

### Added
- AI content generation via Kodee/Gemini API: generate product name, short description, and description per SKU
- Batch AI generation: processes SKUs one-by-one with progress bar (avoids 503 errors)
- AI content cache persisted in `localStorage` (`cdep_ai_cache`), restored on mapping tab load
- AI content modal: "Ver contenido generado con IA" button opens modal with full content instead of rendering inline
- Per-field AI length configuration: name (10-100), short_description (50-200), description (400-800)
- Kodee `sendPrompt($PROMPT, $config)` extended with optional `$config` parameter for per-field overrides
- "Iniciar Creación Masiva" button disabled during AI generation
- Categoría field (`product_cat`) in Configuraciones de Creación with conditional support
- Atributos section: select taxonomy + term with conditional support (multiple conditions per attribute)
- Condicionar redesigned: `__condicionar__` option in main select (brand, category, attributes) replaces checkbox toggle
- Multi-condition support per config row: arrays of `{column, operator, value, apply}` with operators `<`, `=`, `>`, `!=`
- Condition operators: case-insensitive string compare for `=`/`!=`, float compare for `<`/`>`
- Backward compatibility: `buildMapping()` and `restoreMappingConfig()` handle legacy single-object condition format
- Preview evaluates conditions for categories and attributes — shows effective values per product row
- "Atributos" column in preview table for new products
- `attributeTaxonomies` passed to JS via `window.cdep` (`wp_localize_script`) with taxonomy names, labels, and term lists
- `evaluateCondition()` in PHP resolves `{var}` placeholders in condition values via config_vars + columns
- CSS: `.cdep-attr-list` for attribute display in preview table

### Fixed
- AI field display: shows "Ver contenido generado con IA" button only when content exists; "Pendiente de generar" when empty
- AI tab reset: auto-switch to "Productos a crear" tab after generation
- AI content stored in `state.aiGenerated` (JS) and `$aiData` (PHP) — persists across tab switches
- `populateAttributeTerms()` preserves `__condicionar__` option via `.filter()` instead of broken `[value!="__condicionar__"]` selector
- Duplicate `.cdep-condition-add` handlers for attribute condition rows: generic handler skips buttons inside `.cdep-attribute-condition-row`
- `buildMapping()` no longer stores `term: '__condicionar__'` for conditional attributes — uses empty string with conditions array
- `validateMapping()` and `executeUpdate()` use condition's `apply` value when conditions exist instead of raw `__condicionar__` term

---

## [1.1.15] - 2026-06-25

### Added
- Split mapping into two sections: update existing (3 fields) and create new (16 fields)
- Preview results split into "Productos a actualizar" and "Productos a crear" tabs
- Creation configuration section with brand selector (`product_brand` taxonomy)
- Custom template support: "Personalizar" option with `{column_name}` variables
- Config variables (from creation config) appear in template variable list with separator
- Product name now links to WooCommerce editor (like SKU)

### Changed
- Brand value uses term name instead of slug (both for attribute and template resolution)
- `resolveTemplate()`, `validateMapping()`, `executeUpdate()` accept `$configVars` parameter
- Updated documentation files (AGENTS.md, README.md, CONTEXT.md, CHANGELOG.md)

---

## [1.1.14] - 2026-06-25

### Added
- SKU link to product: existing SKUs in preview open WooCommerce editor in new tab

### Changed
- Updated documentation files (AGENTS.md, README.md, CONTEXT.md, SKILL.md)

---

## [1.1.13] - 2026-06-24

### Added
- Save mapping configuration to `localStorage` for persistence between sessions

---

## [1.1.12] - 2026-06-24

No code changes (release tag only).

---

## [1.1.11] - 2026-06-24

### Changed
- Moved default product image to a constant variable

---

## [1.1.10] - 2026-06-24

### Fixed
- Colgroup loading in products preview table

---

## [1.1.9] - 2026-06-24

### Added
- `<colgroup>` to products table for better column width control
- Default product image fallback

---

## [1.1.8] - 2026-06-24

### Changed
- Table layout adjustments for import preview

---

## [1.1.7] - 2026-06-24

No code changes (release tag only).

---

## [1.1.6] - 2026-06-24

### Fixed
- Single product processing not updating correctly

---

## [1.1.5] - 2026-06-24

### Fixed
- Column detection and default status handling

---

## [1.1.4] - 2026-06-24

### Added
- Processing button state (disabled + text change) during AJAX calls

---

## [1.1.3] - 2026-06-24

### Fixed
- Money format handling in price fields

---

## [1.1.2] - 2026-06-24

### Fixed
- Value format sanitization

---

## [1.1.1] - 2026-06-24

### Fixed
- Excel/CSV parsing edge cases

---

## [1.1.0] - 2026-06-24

### Added
- Full product field mapping: 16 WooCommerce fields (price, stock, weight, dimensions, tax, status, name, description, etc.)
- Product creation for SKUs not found in WooCommerce
- `cdep_update_single` AJAX endpoint for individual product processing
- `cdep_update_batch_skus` AJAX endpoint for batch SKU processing
- Column auto-detection for sale_price in addition to regular_price and quantity
- Header row selection (configurable row for column names)
- Re-parse file with different header row via AJAX (`cdep_reparse_file`)
- Cache system for parsed data (`CDEP_SELECTED_DATA`)

### Changed
- `CDEP_EXCEL::parse()` now accepts `$headerRow` parameter
- `CDEP_EXCEL::detectColumns()` detects 4 column types (sku, price, sale_price, quantity)
- Mapping tab redesigned with dynamic field mapping table
- Update execution moved to mapping tab (update.php is legacy)

---

## [1.0.12] - 2026-06-23

### Added
- Collapsible sections and scrollable tables in UI

---

## [1.0.11] - 2026-06-23

### Added
- Configurable header row number input in mapping tab

---

## [1.0.10] - 2026-06-23

### Added
- File ordering (folders first, then alphabetical)
- File filtering (only show folders and spreadsheets)
- Google Sheets (.gsheet) mime type support

---

## [1.0.9] - 2026-06-23

### Fixed
- Folder state persistence (save/restore current folder)

---

## [1.0.8] - 2026-06-23

### Added
- Folder navigation state persisted to `localStorage`

---

## [1.0.7] - 2026-06-23

### Fixed
- Column field mapping validation

---

## [1.0.6] - 2026-06-23

### Fixed
- Mapping validation logic in `CDEP_PRODUCTS::validateMapping()`

---

## [1.0.5] - 2026-06-23

### Changed
- Mapping tab layout and UX adjustments

---

## [1.0.4] - 2026-06-23

### Changed
- File loading and selection UX improvements

---

## [1.0.3] - 2026-06-23

### Changed
- File selection flow and UI adjustments

---

## [1.0.2] - 2026-06-23

### Fixed
- File explorer tab navigation

---

## [1.0.1] - 2026-06-22

### Added
- OAuth configuration via POST form (connect.php)
- Initial AJAX endpoints for save config, auth URL, connect, disconnect, list, select file, update preview, update execute

### Fixed
- Configuration saving flow

---

## [1.0.0] - 2026-06-21

### Added
- Initial release
- Google Drive OAuth 2.0 connection
- File explorer with folder navigation
- Excel/CSV parsing with PhpSpreadsheet
- Basic column mapping (SKU, price, quantity)
- Mass update of WooCommerce products in batches of 25
- Progress bar for batch updates
- Security: nonces, capability checks, sanitization, escaping
- Auto-updater via GitHub (FWUUpdate)
- Logging via FWUSystemLog
