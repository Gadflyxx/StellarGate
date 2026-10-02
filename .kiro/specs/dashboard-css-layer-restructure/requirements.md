# Requirements Document: Dashboard CSS Layer Restructuring

## Introduction

The StellarGate dashboard currently has a monolithic `dashboard.css` file with inline styles organized by visual sections (theme tokens, focus, form controls, layout, components, etc.) but without explicit CSS layer boundaries. This causes potential style conflicts and makes it difficult to override specific styles predictably. The goal is to restructure this stylesheet by splitting it into CSS `@layer` blocks (`base`, `layout`, `components`, `utilities`) following the ITCSS (Inverted Triangle CSS) methodology. This refactoring improves style organization and predictability without changing any visual appearance or functionality of the dashboard in any browser or viewport size.

## Glossary

- **Dashboard**: The StellarGate web interface served at `/dashboard`, including HTML markup, JavaScript, CSS, and related assets.
- **CSS @layer**: A CSS feature that creates named cascade layers to control specificity and override order of stylesheets and rules.
- **ITCSS**: Inverted Triangle CSS methodology that organizes stylesheets from generic to specific: `base` → `layout` → `components` → `utilities`.
- **Base Layer**: Contains CSS resets, theme tokens (CSS custom properties), global element styles, and fundamental styling rules that apply throughout the page.
- **Layout Layer**: Contains structural styles for major page sections: the grid system, positioning, spacing for the gate, topbar, main content area, and overall page structure.
- **Components Layer**: Contains styles for discrete, reusable UI components: buttons, forms, cards, tables, panels, modals, and their variants (primary, ghost, etc.).
- **Utilities Layer**: Contains single-purpose, low-specificity helper classes: spacing classes, text utilities, display utilities, and override classes.
- **Visual Regression**: Unintended changes to the visual appearance or layout of the page that differ from the current rendering.
- **Dashboard Asset Test**: The `tests/dashboard_asset_tests.rs` test suite that validates dashboard HTML, CSS, and JavaScript structure, CSP compliance, focus management, theme handling, and security headers.
- **Existing Test Suite**: The `tests/dashboard_asset_tests.rs` file that must pass after the restructuring with zero visual changes.

## Requirements

### Requirement 1: Organize Theme Tokens in Base Layer

**User Story:** As a developer, I want theme tokens organized in a dedicated section within the `base` layer, so that color schemes and design tokens are centralized and easily maintained.

#### Acceptance Criteria

1. WHEN the stylesheet loads, THE Base_Layer SHALL define all CSS custom property tokens (colors, typography, spacing, border radius, shadows) at the start of the `@layer base` block.
2. THE Base_Layer SHALL contain theme token definitions for `:root`, `@media (prefers-color-scheme: dark)` with `:root:not([data-theme])`, `html[data-theme="light"]`, and `html[data-theme="dark"]`.
3. WHERE color contrast auditing is performed, THE Base_Layer SHALL contain all color tokens (`--bg`, `--surface`, `--border`, `--control-border`, `--focus`, `--text`, `--muted`, `--accent`, `--accent-text`, `--ok`, `--ok-bg`, `--warn`, `--warn-bg`, `--err`, `--err-bg`, `--idle`, `--idle-bg`, `--skeleton-base`, `--skeleton-shine`, `--radius`) in every theme block without omission.

### Requirement 2: Define Reset and Global Styles in Base Layer

**User Story:** As a developer, I want CSS reset and global element rules in the `base` layer, so that all elements have consistent initial styling.

#### Acceptance Criteria

1. WHEN the stylesheet loads, THE Base_Layer SHALL include reset rules: `*` box-sizing rule, `body` margin and font declarations, `[hidden]` display rule.
2. THE Base_Layer SHALL include global element styles for `h1`, `h2`, `h3`, form controls (`input`, `select`), and `button` without component variants.
3. THE Base_Layer SHALL define utilities like `.visually-hidden`, `.muted`, `.small`, `.mono`, and `.card` within the `@layer base` block.
4. THE Base_Layer SHALL define the focus styles (`:focus-visible` and table row focus) without any specificity that would prevent component-level overrides.

### Requirement 3: Organize Page Layout Structures in Layout Layer

**User Story:** As a developer, I want major structural layouts isolated in the `layout` layer, so that grid systems and page structure remain independent of component styling.

#### Acceptance Criteria

1. WHEN the page renders, THE Layout_Layer SHALL define layout styles for the sign-in gate (`.gate`, `.gate-card`, `.gate-head`) within `@layer layout`.
2. THE Layout_Layer SHALL define styles for the top navigation bar (`.topbar`, `.brand`, `.topbar-right`) and main content area (`main`, `.toolbar`, `.filters`, `.search`, `.summary`, `.summary-card`) within `@layer layout`.
3. THE Layout_Layer SHALL define structural styles for tables (`.payments` table structure, `.table-foot`) without component styling within `@layer layout`.
4. THE Layout_Layer SHALL preserve grid column definitions, spacing, and positioning without affecting color or component-specific rules.

### Requirement 4: Group Reusable Components in Components Layer

**User Story:** As a developer, I want discrete UI components isolated in the `components` layer, so that component styling remains maintainable and doesn't conflict with layout or utilities.

#### Acceptance Criteria

1. WHEN the page renders, THE Components_Layer SHALL contain button styles (`.primary`, `.ghost`, button:hover, button:disabled, `.chip`, `.chip-on`) within `@layer components`.
2. THE Components_Layer SHALL contain form-specific component styles (`.gate-card label`, `.checkbox`, `input[type="date"]`, `input[type="checkbox"]`) within `@layer components`.
3. THE Components_Layer SHALL contain modal/dialog styles (`.detail`, `.detail::backdrop`, `.detail-head`, `.fields`, `.deliveries`, `.delivery`, `.delivery-head`, `.delivery-meta`, `.delivery button`) within `@layer components`.
4. THE Components_Layer SHALL contain table component styles (`.payments th`, `.payments td`, `.payments tbody tr:hover`, `.payments tbody tr.row-active`) within `@layer components`.
5. THE Components_Layer SHALL contain status indicator styles (`.pill`, `.pill-ok`, `.pill-warn`, `.pill-err`, `.pill-idle`) within `@layer components`.
6. THE Components_Layer SHALL contain loading skeleton styles (`.skeleton-cell`, `.skeleton-row`, `.skeleton-field`, `.skeleton-field-short`, `.skeleton-field-long`, `.skeleton-field-full`) within `@layer components`.
7. THE Components_Layer SHALL contain error/empty state styles (`.error`, `.error-state`, `.error-state-message`, `.empty-state`, `.empty-state-icon`, `.empty-state-title`, `.empty-state-body`, `.empty`) within `@layer components`.
8. THE Components_Layer SHALL contain help overlay/modal styles (`.help`, `.help-panel`, `.help-list`, `.help-row`, `kbd`) within `@layer components`.
9. THE Components_Layer SHALL contain theme toggle button styles (`.theme-toggle`, `.theme-icon`) within `@layer components`.

### Requirement 5: Place Single-Purpose Helpers in Utilities Layer

**User Story:** As a developer, I want single-purpose utility classes isolated in the `utilities` layer, so that they have the lowest specificity and can override component styles when needed.

#### Acceptance Criteria

1. WHEN the page renders, THE Utilities_Layer SHALL contain animation keyframes (specifically `@keyframes skeleton-shimmer`) and animation-related rules within `@layer utilities`.
2. THE Utilities_Layer SHALL contain media query responsive rules for mobile viewports (`@media (max-width: 720px)`) that restructure table layout, skeleton cells, and other responsive behavior within `@layer utilities`.
3. THE Utilities_Layer SHALL contain the reduced motion preference rule (`@media (prefers-reduced-motion: no-preference)`) and related animation application within `@layer utilities`.

### Requirement 6: Preserve Exact CSS Syntax and Specificity

**User Story:** As a developer, I want the CSS layer restructuring to maintain identical syntax and CSS specificity for every rule, so that visual rendering remains pixel-perfect identical to the original.

#### Acceptance Criteria

1. FOR EVERY CSS rule in the original file, THE Restructured_Stylesheet SHALL preserve the exact selector, property declarations, and property values without modification.
2. FOR EVERY CSS rule in the original file, THE Restructured_Stylesheet SHALL maintain identical specificity relationships (e.g., `.detail` vs `.detail:focus-visible` specificities remain unchanged).
3. THE Restructured_Stylesheet SHALL introduce `@layer base, layout, components, utilities;` at the very top before any rules to establish the layer cascade order.
4. THE Restructured_Stylesheet SHALL wrap each logical group of rules within their respective `@layer` block using `@layer base { /* rules */ }` syntax, with no changes to the rules themselves.

### Requirement 7: Support All Current Browsers and Viewports Without Regression

**User Story:** As a developer, I want the restructured stylesheet to work identically across all supported browsers and viewport sizes, so that users experience no visual changes.

#### Acceptance Criteria

1. WHEN the dashboard renders in Chrome (current version) desktop, THE Dashboard_Styling SHALL display identically to the original stylesheet in layout, colors, typography, spacing, and component appearance.
2. WHEN the dashboard renders in Firefox (current version) desktop, THE Dashboard_Styling SHALL display identically to the original stylesheet in layout, colors, typography, spacing, and component appearance.
3. WHEN the dashboard renders in Safari (current version) desktop, THE Dashboard_Styling SHALL display identically to the original stylesheet in layout, colors, typography, spacing, and component appearance.
4. WHEN the dashboard renders at mobile viewport width (`max-width: 720px`) in Chrome, Firefox, or Safari, THE Dashboard_Styling SHALL apply the mobile-specific responsive rules identically to the original stylesheet.
5. WHEN the dashboard renders at desktop viewport width (wider than 720px) in Chrome, Firefox, or Safari, THE Dashboard_Styling SHALL NOT apply mobile-specific responsive rules, matching the original behavior.
6. WHEN the dashboard theme changes between light and dark modes via the theme toggle, THE Dashboard_Styling SHALL apply the correct palette in both browsers and both viewport sizes without visual difference from the original.

### Requirement 8: No Security or Key Exposure Changes

**User Story:** As an operator, I want the restructured stylesheet to maintain all existing security properties, so that API keys remain protected.

#### Acceptance Criteria

1. THE Restructured_Stylesheet SHALL contain no new inline JavaScript or script tags.
2. THE Restructured_Stylesheet SHALL NOT introduce any `url()` references that could encode or transmit data.
3. THE Restructured_Stylesheet SHALL remain compatible with the existing Content-Security-Policy (`script-src 'self'; style-src 'self'`) without requiring changes to CSP headers.
4. THE Restructured_Stylesheet SHALL maintain that no API key appears in any URL, log line, or console output (this property is enforced by separate tests).

### Requirement 9: Pass All Existing Dashboard Asset Tests

**User Story:** As a developer, I want all dashboard asset tests to pass after restructuring, so that security, structure, and functionality contracts remain upheld.

#### Acceptance Criteria

1. WHEN the test suite `tests/dashboard_asset_tests.rs` is run, ALL tests SHALL pass without modification to the test file.
2. WHEN the test `focus_ring_offset_is_preserved` runs, THE Restructured_Stylesheet SHALL contain the exact string `outline-offset: 2px;` with the same specificity context.
3. WHEN the test `contrast_audit_can_find_every_theme_block` runs, THE Restructured_Stylesheet SHALL contain all four theme blocks (`:root`, `:root:not([data-theme])`, `html[data-theme="light"]`, `html[data-theme="dark"]`) with the same selector structure.
4. WHEN the test `dashboard_assets_keep_content_type_and_csp` runs, THE Dashboard_CSS file SHALL be served with `content-type: text/css; charset=utf-8` and the unchanged dashboard CSP header.
5. WHEN the test `every_dashboard_helper_the_script_calls_is_defined` runs, THE CSS file changes SHALL NOT affect JavaScript function definitions.

### Requirement 10: Maintain Responsive Mobile Layout

**User Story:** As an operator, I want the mobile responsive layout to remain fully functional after restructuring, so that dashboard usability on phones and tablets is unchanged.

#### Acceptance Criteria

1. WHEN the viewport width is 720px or narrower, THE Dashboard_Layout SHALL apply the mobile table restructuring rules (display: block, hidden headers, stacked rows) identically to the original.
2. WHEN the viewport width is wider than 720px, THE Dashboard_Layout SHALL NOT apply mobile table restructuring and SHALL display the table normally.
3. WHERE skeleton loading placeholders are visible on mobile, THE Animation_Behavior SHALL apply shimmer animation identically to desktop, respecting `prefers-reduced-motion` in both viewports.

### Requirement 11: Maintain Reduced Motion Preferences

**User Story:** As an operator using accessibility preferences, I want reduced motion preferences to be respected identically after restructuring, so that animation behavior remains predictable and accessible.

#### Acceptance Criteria

1. WHEN the OS or browser indicates `prefers-reduced-motion: reduce` (or equivalent), THE Dashboard_Styling SHALL NOT apply the skeleton shimmer animation or transition animations to any elements.
2. WHEN the OS or browser indicates `prefers-reduced-motion: no-preference`, THE Dashboard_Styling SHALL apply animations (skeleton shimmer, detail panel transitions) identically to the original.
3. WHERE CSS transitions are defined on the detail panel (`.detail` open/close animation), THE Transitions SHALL work identically with and without the layer restructuring.

### Requirement 12: Create Maintainable Layer Organization

**User Story:** As a developer, I want the layer structure to be clearly organized and documented, so that future modifications follow the established pattern consistently.

#### Acceptance Criteria

1. THE Restructured_Stylesheet SHALL include clear comments marking the start of each layer (e.g., `/* ── @layer base ────────────────────────────────────────── */`).
2. THE Layer_Comments SHALL preserve the existing section comments within each layer block (e.g., theme tokens, focus, form controls).
3. THE Restructured_Stylesheet SHALL maintain the existing inline documentation that explains design decisions (e.g., color token reasoning, focus offset importance).
4. THE Restructured_Stylesheet organization SHALL follow a logical progression from base → layout → components → utilities with clear visual separation between layers.

