/**
 * @file lib/types/invoice.js
 * Single source of truth for the invoice data shape used across the marketplace,
 * invoice list, skeleton, and API client.
 *
 * This file owns three coupled contracts:
 *   1. The `Invoice` shape itself (typedef).
 *   2. The typed `InvoiceStatus` union and the `INVOICE_STATUSES` enum — the
 *      canonical, exhaustive vocabulary of status values the product supports.
 *   3. The `STATUS_PILL_MAP` mapping every known status to its human-readable
 *      label and Tailwind tone classes.  The map lives here, in one place, so
 *      any new status must be added to all three tables or the build will
 *      diverge.
 *
 * The actual rendering lives in `components/StatusPill.jsx`; this file is the
 * authoritative data contract it reads from.
 */

/**
 * @typedef {Object} Invoice
 * @property {string}        id        - Unique invoice identifier (e.g. "INV-001")
 * @property {string}        issuer    - Name of the invoice issuer / SME
 * @property {number|string} amount    - Invoice face value (numeric for sorting,
 *                                        formatted string for display)
 * @property {string}        currency  - ISO 4217 currency code (e.g. "USDC", "USD")
 * @property {string}        dueDate   - ISO 8601 date string (e.g. "2025-09-30")
 * @property {number|string} yield     - Expected annual yield as a percentage
 *                                        (e.g. 8.5 or "8.5%")
 * @property {InvoiceStatus} status    - One of the typed InvoiceStatus values
 */

/**
 * The exhaustive set of status values an invoice can carry.
 *
 * Consumers SHOULD treat any value outside this union as `Unknown` and render
 * the neutral pill; see `STATUS_PILL_MAP["Unknown"]`.
 *
 * @typedef {"Open" | "Funded" | "Settled" | "Overdue"} InvoiceStatus
 */

/**
 * Valid invoice status values.
 *
 * TitleCase by design: matches the mock data and the InvoiceStatus union so a
 * value can be used both as a runtime comparison and a typed shape without a
 * translation layer.
 *
 * @readonly
 * @enum {InvoiceStatus}
 */
export const INVOICE_STATUSES = /** @type {const} */ ({
  OPEN: "Open",
  FUNDED: "Funded",
  SETTLED: "Settled",
  OVERDUE: "Overdue",
});

Object.freeze(INVOICE_STATUSES);

/**
 * Presentation metadata for every known status plus the mandatory neutral
 * fallback.
 *
 * @type {{ [status: string]: { label: string, tone: string } }}
 */
export const STATUS_PILL_MAP = {
  Open: {
    label: "Open",
    tone: "bg-cyan-900/40 text-cyan-300",
  },
  Funded: {
    label: "Funded",
    tone: "bg-slate-700/40 text-slate-300",
  },
  Settled: {
    label: "Settled",
    tone: "bg-emerald-900/30 text-emerald-300",
  },
  Overdue: {
    label: "Overdue by maturity",
    tone: "bg-amber-900/40 text-amber-300",
  },
  Unknown: {
    label: "Unknown",
    tone: "bg-slate-800/50 text-slate-400",
  },
};

Object.freeze(STATUS_PILL_MAP);

/**
 * Resolves an arbitrary input to a canonical status-pill entry.
 *
 * Returns a fresh-shaped object every call so callers can safely destructure
 * without accidentally mutating shared state.  Deterministic for the same
 * input.
 *
 * @param {unknown} status - Any value (string, null, undefined, etc.)
 * @returns {{ key: string, label: string, tone: string }}
 */
export function resolveStatusPill(status) {
  const key =
    typeof status === "string" && Object.prototype.hasOwnProperty.call(STATUS_PILL_MAP, status)
      ? status
      : "Unknown";

  return { key, ...STATUS_PILL_MAP[key] };
}
