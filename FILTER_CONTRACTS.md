# Filter Controls — Implementation Contract

## Overview

The invest marketplace exposes client-side filter controls for yield, currency, maturity date, and sort order, plus an issuer search field. Filtered results are summarized above the invoice list with a visible count line and removable active-filter chips.

## Filter Controls

### 1. Issuer Search

- **Purpose:** Filter invoices by issuer name (case-insensitive substring match).
- **UI:** `InvoiceSearch` component with debounced input (`SEARCH_DEBOUNCE_MS = 200`).
- **Active chip:** `Search: {query}` — removing clears the search field.

### 2. Yield Range Filter

- **Purpose:** Filter invoices by yield percentage range.
- **Future API Contract:** `GET /api/invoices?yield_min=5&yield_max=10`
- **Active chips:** `Min yield: {n}%`, `Max yield: {n}%`

### 3. Currency Filter

- **Purpose:** Filter invoices by currency type (USD, EUR, GBP, JPY, CHF).
- **Future API Contract:** `GET /api/invoices?currency=USD`
- **Active chip:** `Currency: {code}`

### 4. Maturity Date Filter

- **Purpose:** Filter invoices by maturity date range.
- **Future API Contract:** `GET /api/invoices?maturity_from=2026-06-01&maturity_to=2026-12-31`
- **Active chips:** `From: {date}`, `To: {date}`

### 5. Sort Options

- **Purpose:** Sort filtered invoices by yield, amount, or maturity.
- **Future API Contract:** `GET /api/invoices?sort=yield_desc|amount_asc|maturity_asc`
- **Active chip:** `Sort: {label}` (e.g. `Sort: Best Yield`)

### 6. Clear Filters

- **Filter panel:** `Clear Filters` button resets structured filters only (yield, currency, maturity, sort).
- **Results summary:** `Clear all` button resets structured filters **and** the issuer search query.

## Results Summary

Rendered by `ActiveFilterSummary` in [`components/InvoiceFilters.jsx`](components/InvoiceFilters.jsx), placed above the invoice list in [`app/invest/page.js`](app/invest/page.js).

### Visible count line

- Format: **`Showing {visible} of {filteredTotal} invoice(s)`**
- `{visible}` — invoices currently rendered (respects pagination / load-more).
- `{filteredTotal}` — total invoices matching the current search + filter derivation.

### Active-filter chips

- One removable chip per active filter (including search).
- Each chip exposes `aria-label="Remove {label}"` and removes only that filter.
- `Clear all` resets every active filter and the search query.

## Accessibility

- **Single live region:** One screen-reader-only `role="status"` region with `aria-live="polite"` in the invest page announces load, filter, and pagination changes. The visible summary line does not use `aria-live` to avoid competing announcements.
- All filter inputs and chip remove buttons are keyboard-focusable with visible focus rings.
- Active-filter chip list uses `aria-label="Active filters"`.

## Responsive Design

- Filter controls and chip row wrap on smaller screens using `flex-wrap`.
- Maintains spacing and layout across breakpoints.

## Implementation Notes

- Filter derivation lives in `filterInvoices()` exported from `app/invest/page.js`.
- Chip metadata is built by `getActiveFilterChips()` in `components/InvoiceFilters.jsx`.
- Pagination resets to `PAGE_SIZE` whenever search or structured filters change.

## Backend Integration Requirements

When implementing server-side filtering:

1. Mirror the query parameters documented above.
2. Return total unfiltered count separately if needed for “X of Y total marketplace” views.
3. Validate filter parameters and return appropriate error responses.

## Testing Checklist

- [x] Visible summary shows `Showing X of Y invoices` from filtered derivation
- [x] Active-filter chips appear for search and each structured filter
- [x] Individual chip remove clears only that filter
- [x] `Clear all` resets search and structured filters
- [x] Single polite live region announces filter/load updates
- [x] Summary visible when zero invoices match (with chips retained)
- [x] Responsive layout wraps on narrow viewports
