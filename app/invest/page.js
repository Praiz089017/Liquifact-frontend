"use client";
import Button from '@/components/Button';

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ErrorBanner from "@/components/ErrorBanner";
import InvoiceCard from "@/components/InvoiceCard";
import InvoiceListSkeleton from "@/components/InvoiceListSkeleton";
import Pagination from "@/components/Pagination";
import { copy } from "../copy/en";

/**
 * Number of invoices rendered per page.  Export allows tests to reference
 * the same constant without hard-coding a magic number.
 */
export const PAGE_SIZE = 10;

/**
 * Mock invoice data — replace with real API call once the backend endpoint
 * is available (follow-up: link backend issue here).
 *
 * Shape: { id, issuer, amount, currency, dueDate, yield, status }
 * See lib/types/invoice.js for the canonical typedef.
 * NOTE: yield values are illustrative; contracts use on-chain basis points and actual settlement is at maturity.
 *
 * @type {import('@/lib/types/invoice').Invoice[]}
 */
const MOCK_INVOICES = [
  {
    id: "inv-001",
    issuer: "Acme Supplies Ltd",
    amount: 12500,
    currency: "USD",
    dueDate: "2026-06-15",
    yield: 8.2,
    status: "available",
  },
  {
    id: "inv-002",
    issuer: "Bright Logistics GmbH",
    amount: 7800,
    currency: "EUR",
    dueDate: "2026-07-01",
    yield: 7.5,
    status: "available",
  },
  {
    id: "inv-003",
    issuer: "Sunrise Exports Pte",
    amount: 22000,
    currency: "USD",
    dueDate: "2026-05-30",
    yield: 9.1,
    status: "available",
  },
];

// DEV-only delay (ms) to make the skeleton visible during local development.
const DEV_DELAY = process.env.NODE_ENV === "development" ? 1500 : 0;

function loadMockInvoices() {
  return new Promise((resolve) => {
    setTimeout(() => resolve(MOCK_INVOICES), DEV_DELAY);
  });
}

/**
 * Returns the screen-reader announcement text for the initial invoice load.
 *
 * @param {import('@/lib/types/invoice').Invoice[]} invoices - The resolved invoice array (may be empty).
 * @returns {string}
 */
export function getInvoiceLoadAnnouncement(invoices) {
  if (!Array.isArray(invoices) || invoices.length === 0) {
    return "No invoices available";
  }
  return `${invoices.length} investable invoices loaded`;
}

/**
 * Returns the screen-reader announcement text for the current pagination state.
 *
 * @param {number} shown - Number of invoices currently visible.
 * @param {number} total - Total number of invoices available.
 * @returns {string}
 */
export function getPaginationAnnouncement(shown, total) {
  return `Showing ${shown} of ${total} investable invoices`;
}

/**
 * InvestMarketplace — main component for the invest page.
 *
 * Fetches invoices via `loadInvoices`, renders them PAGE_SIZE at a time,
 * and exposes a "Load more" control to append the next batch.  Paging
 * resets whenever a new invoice set arrives so filter changes (future) stay
 * non-breaking.
 *
 * @param {object}   props
 * @param {Function} [props.loadInvoices] - Async function that resolves to an
 *   invoice array.  Defaults to the mock loader; injectable for testing.
 * @returns {JSX.Element}
 */
export function InvestMarketplace({ loadInvoices = loadMockInvoices }) {
  const [invoices, setInvoices] = useState(null); // null = loading
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [statusMessage, setStatusMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  /** Ref forwarded to the "Load more" button for focus management. */
  const loadMoreRef = useRef(null);

  // ── Fetch invoices ────────────────────────────────────────────────────────
  useEffect(() => {
    let isActive = true;

    const announceLoadCompletion = async () => {
      try {
        const nextInvoices = await loadInvoices();

        if (!isActive) return;

        const normalizedInvoices = Array.isArray(nextInvoices) ? nextInvoices : [];

        setInvoices(normalizedInvoices);
        setStatusMessage(getInvoiceLoadAnnouncement(normalizedInvoices));
      } catch {
        if (!isActive) return;

        setInvoices([]);
        setLoadError(copy.invest.errorDescription);
        setStatusMessage(copy.invest.errorStatus);
      }
    };

    void announceLoadCompletion();

    return () => {
      isActive = false;
    };
  }, [loadInvoices]);

  // ── Reset paging when a new invoice set arrives ───────────────────────────
  useEffect(() => {
    if (invoices !== null) {
      setVisibleCount(PAGE_SIZE);
    }
  }, [invoices]);

  // ── Load-more handler ─────────────────────────────────────────────────────
  /**
   * Appends the next PAGE_SIZE items and updates the live-region status.
   * Focus is moved back to the "Load more" button (if it still exists) so
   * keyboard users do not lose their place in the page.
   */
  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => {
      const next = Math.min(prev + PAGE_SIZE, invoices?.length ?? prev);
      const total = invoices?.length ?? 0;
      setStatusMessage(getPaginationAnnouncement(next, total));
      return next;
    });

    // Restore focus on next tick so the button is still in the DOM when we focus it.
    setTimeout(() => {
      loadMoreRef.current?.focus();
    }, 0);
  }, [invoices]);

  // ── Derived values ────────────────────────────────────────────────────────
  const visibleInvoices = Array.isArray(invoices)
    ? invoices.slice(0, visibleCount)
    : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4">
        <Link
          href="/"
          className="inline-block py-3 text-xl font-semibold tracking-tight text-cyan-400 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 rounded"
        >
          {copy.layout.backToHome}
        </Link>
      </header>

      <main id="main-content" className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-2">{copy.invest.title}</h1>
        <p className="text-slate-400 mb-8">{copy.invest.subtext}</p>

        <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {statusMessage}
        </p>

        {/* Filter Controls - Disabled with Coming Soon Indicators */}
        <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900/30 p-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Issuer Search */}
            <div className="flex items-center gap-2">
              <label htmlFor="issuer-search" className="sr-only">Filter by issuer</label>
              <input
                id="issuer-search"
                type="search"
                placeholder="Filter by issuer…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-950"
              />
            </div>

            {/* Yield Range Filter */}
            <div className="flex items-center gap-2">
              <Button variant="secondary" disabled>Coming Soon</Button>
              <span className="inline-flex items-center rounded-full bg-slate-700/60 px-2.5 py-1 text-xs font-medium text-slate-300">Soon</span>
            </div>

            {/* Currency Filter */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled
                className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2 text-sm text-slate-500 cursor-not-allowed opacity-60 transition-colors"
                aria-label="Currency filter (coming soon)"
              >
                Currency
                <svg className="inline-block ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <span className="inline-flex items-center rounded-full bg-slate-700/60 px-2.5 py-1 text-xs font-medium text-slate-300">Soon</span>
            </div>

            {/* Maturity Date Filter */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled
                className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2 text-sm text-slate-500 cursor-not-allowed opacity-60 transition-colors"
                aria-label="Maturity date filter (coming soon)"
              >
                Maturity Date
                <svg className="inline-block ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <span className="inline-flex items-center rounded-full bg-slate-700/60 px-2.5 py-1 text-xs font-medium text-slate-300">Soon</span>
            </div>

            {/* Sort Options */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled
                className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2 text-sm text-slate-500 cursor-not-allowed opacity-60 transition-colors"
                aria-label="Sort options (coming soon)"
              >
                Sort: Best Yield
                <svg className="inline-block ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <span className="inline-flex items-center rounded-full bg-slate-700/60 px-2.5 py-1 text-xs font-medium text-slate-300">Soon</span>
            </div>

            {/* Clear Filters - Also Disabled */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                disabled
                className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2 text-sm text-slate-500 cursor-not-allowed opacity-60 transition-colors"
                aria-label="Clear filters (coming soon)"
              >
                Clear Filters
              </button>
              <span className="inline-flex items-center rounded-full bg-slate-700/60 px-2.5 py-1 text-xs font-medium text-slate-300">Soon</span>
            </div>
          </div>
        </div>

        {loadError ? (
          <ErrorBanner
            variant="error"
            title={copy.invest.errorTitle}
            description={loadError}
            previewLabel="Marketplace status"
          />
        ) : invoices === null ? (
          <InvoiceListSkeleton rows={3} />
        ) : invoices.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-8 text-center text-slate-300">
            {copy.invest.emptyState}
          </div>
        ) : (
          <>
            <ul className="space-y-4">
              {visibleInvoices.map((inv) => (
                <li key={inv.id}>
                  <InvoiceCard invoice={inv} />
                </li>
              ))}
            </ul>

            <Pagination
              ref={loadMoreRef}
              shown={visibleInvoices.length}
              total={invoices.length}
              onLoadMore={handleLoadMore}
            />

            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/30 p-4 text-sm text-slate-300">
              Note: Yield references are educational only and reflect on-chain basis-point assumptions. Invoice contracts settle at maturity.
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function InvestPage() {
  return <InvestMarketplace />;
}