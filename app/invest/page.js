import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import InvoiceListSkeleton from "@/components/InvoiceListSkeleton";
import InvoiceSearch from "@/components/InvoiceSearch";
import { sanitize } from "@/utils/sanitizeUrl";

"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ErrorBanner from "@/components/ErrorBanner";
import InvoiceListSkeleton from "@/components/InvoiceListSkeleton";
import Pagination, { normalizePaginationParams } from "@/components/Pagination";
import InvoiceFilters, { DEFAULT_FILTERS, hasActiveFilters, parseSortState } from "@/components/InvoiceFilters";
import { copy } from "../copy/en";
import { fetchInvestableInvoices } from "../../lib/api/invoices";
import InvoiceSearch from "@/components/InvoiceSearch";

export const PAGE_SIZE = 10;
export const SEARCH_DEBOUNCE_MS = 300;

export function getInvoiceLoadAnnouncement(
  invoices,
  { filterActive = false, filteredCount = 0 } = {}
) {
  if (!Array.isArray(invoices) || invoices.length === 0) {
    return "No invoices available";
  }

  if (filterActive) {
    if (filteredCount === 0) {
      return "No invoices match";
    }
    return `${filteredCount} of ${invoices.length} invoices match`;
  }

  return `${invoices.length} investable invoices loaded`;
}

export function getPaginationAnnouncement(shown, total) {
  if (total === 0) return "No invoices available";
  return `Showing ${shown} of ${total} investable invoices`;
}

/**
 * Parse a numeric amount string like "12,500" → 12500.
 * @param {string} str
 * @returns {number}
 */
function parseAmount(str) {
  return parseFloat(String(str).replace(/,/g, "")) || 0;
}

/**
 * Parse a yield string like "8.2%" → 8.2.
 * @param {string} str
 * @returns {number}
 */
function parseYield(str) {
  return parseFloat(String(str).replace(/%/g, "")) || 0;
}

/**
 * Sort a copy of `list` according to the sort column + direction in `filters`.
 *
 * Supported columns: "amount", "yield", "maturity".
 * Direction: "asc" | "desc".
 *
 * @param {Array}  list
 * @param {object} filters
 * @returns {Array}
 */
export function applySortToList(list, filters) {
  if (!Array.isArray(list) || list.length === 0) return list;

  const { column, dir } = parseSortState(filters);
  if (!column) return list;

  const multiplier = dir === "asc" ? 1 : -1;

  return [...list].sort((a, b) => {
    let diff = 0;
    if (column === "amount") {
      diff = parseAmount(a.amount) - parseAmount(b.amount);
    } else if (column === "yield") {
      diff = parseYield(a.yield) - parseYield(b.yield);
    } else if (column === "maturity") {
      diff = new Date(a.dueDate) - new Date(b.dueDate);
    }
    return multiplier * diff;
  });
}

/**
 * InvestMarketplace – main component for the invest page.
 *
 * Fetches invoices via `loadInvoices`, renders them PAGE_SIZE at a time,
 * and exposes a "Load more" control to append the next batch.  Paging
 * resets whenever a new invoice set arrives so filter changes stay
 * non-breaking.
 *
 * @param {object}   props
 * @param {Function} [props.loadInvoices] - Async function that resolves to an
 *   invoice array.  Defaults to the mock loader; injectable for testing.
 * @returns {JSX.Element}
 */
export function InvestMarketplace({ loadInvoices = fetchInvestableInvoices }) {
  const searchParams = useSearchParams();
  const searchParamsValue = searchParams ?? new URLSearchParams();

  const [invoices, setInvoices] = useState(null); // null = loading
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [statusMessage, setStatusMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  const initialSearch = searchParamsValue.get("search") || "";
  const initialFilters = { ...DEFAULT_FILTERS };
  for (const key of Object.keys(DEFAULT_FILTERS)) {
    if (searchParamsValue.has(key)) {
      initialFilters[key] = searchParamsValue.get(key) || "";
    }
  }

  // Sync state changes back to the URL using replace (no history entry)
  const syncToUrl = () => {
    const params = new URLSearchParams();
    if (searchTerm) params.set("q", searchTerm);
    if (sortOption) params.set("sort", sortOption);
    if (activeFilters.length) params.set("filters", activeFilters.join(","));
    const query = params.toString();
    router.replace(query ? `?${query}` : "/invest");
  };

  // Effect: update URL whenever relevant state changes
  useEffect(() => {
    let active = true;

    const announceLoadCompletion = async () => {
      try {
        const nextInvoices = await loadInvoices({ signal: controller.signal });

        if (!isActive) return;

        const normalizedInvoices = Array.isArray(nextInvoices) ? nextInvoices : [];

        setInvoices(normalizedInvoices);
        setVisibleCount(PAGE_SIZE);
        setStatusMessage(getInvoiceLoadAnnouncement(normalizedInvoices));
      } catch {
        if (!isActive) return;

        setInvoices(null);
        setLoadError(copy.invest.errorDescription);
        setStatusMessage(copy.invest.errorStatus);
      }
    };

    void announceLoadCompletion();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [loadInvoices]);

  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setInvoices(MOCK_INVOICES), DEV_DELAY);
    return () => clearTimeout(timer);
  }, []);

  const handleFilterChange = useCallback((nextFilters) => {
    setFilters(nextFilters);
  }, []);

  const allInvoices = Array.isArray(invoices) ? invoices : [];

  const filteredInvoices = (() => {
    let list = allInvoices;

    // Text search
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.trim().toLowerCase();
      list = list.filter(
        (inv) => inv.issuer?.toLowerCase().includes(q) || inv.id?.toLowerCase().includes(q)
      );
    }

    // Currency filter
    if (filters.currency) {
      list = list.filter((inv) => inv.currency === filters.currency);
    }

    // Yield range filter
    if (filters.yieldMin !== "") {
      const min = parseFloat(filters.yieldMin);
      list = list.filter((inv) => parseYield(inv.yield) >= min);
    }
    if (filters.yieldMax !== "") {
      const max = parseFloat(filters.yieldMax);
      list = list.filter((inv) => parseYield(inv.yield) <= max);
    }

    // Maturity date range filter
    if (filters.maturityFrom) {
      list = list.filter((inv) => inv.dueDate >= filters.maturityFrom);
    }
    if (filters.maturityTo) {
      list = list.filter((inv) => inv.dueDate <= filters.maturityTo);
    }

    // Sort with direction
    list = applySortToList(list, filters);

    return list;
  })();

  const normalizedPagination = normalizePaginationParams({
    page: searchParamsValue.get("page"),
    pageSize: searchParamsValue.get("pageSize"),
    totalItems: filteredInvoices.length,
    defaultPageSize: PAGE_SIZE,
  });

  useEffect(() => {
    const nextVisibleCount = Math.min(
      normalizedPagination.page * normalizedPagination.pageSize,
      filteredInvoices.length,
    );
    setVisibleCount(nextVisibleCount > 0 ? nextVisibleCount : 0);
  }, [filteredInvoices.length, normalizedPagination.page, normalizedPagination.pageSize]);

  useEffect(() => {
    if (invoices === null || loadError) return;

    const hasUserAppliedFilters = Boolean(debouncedQuery.trim()) || hasActiveFilters(filters);

    if (allInvoices.length === 0) {
      setStatusMessage("No invoices available");
      return;
    }

    if (!hasUserAppliedFilters) {
      setStatusMessage(getInvoiceLoadAnnouncement(allInvoices));
      return;
    }

    if (debouncedQuery.trim()) {
      setStatusMessage(
        getInvoiceLoadAnnouncement(allInvoices, {
          filterActive: true,
          filteredCount: filteredInvoices.length,
        })
      );
      return;
    }

    setStatusMessage(getPaginationAnnouncement(filteredInvoices.length, filteredInvoices.length));
  }, [allInvoices, debouncedQuery, filters, filteredInvoices.length, invoices, loadError, visibleCount]);

  // ── Load-more handler ──────────────────────────────────────────────────────
  /**
   * Appends the next PAGE_SIZE items and updates the live-region status.
   * Focus is moved back to the "Load more" button (if it still exists) so
   * keyboard users do not lose their place in the page.
   */
  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => {
      const next = Math.min(prev + normalizedPagination.pageSize, filteredInvoices.length || prev);
      const total = filteredInvoices.length;
      setStatusMessage(getPaginationAnnouncement(next, total));
      return next;
    });

    // Restore focus on next tick so the button is still in the DOM when we focus it.
    setTimeout(() => {
      loadMoreRef.current?.focus();
    }, 0);
  }, [filteredInvoices, normalizedPagination.pageSize]);

  const visibleInvoices = filteredInvoices.slice(0, visibleCount);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4">
        <Link href="/" className="inline-block py-3 text-xl font-semibold tracking-tight text-cyan-400 hover:underline">
          ← LiquiFact
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-2">Invest</h1>
        <p className="text-slate-400 mb-8">
          Browse tokenized invoices and fund them. Estimated yield is shown for educational purposes; actual payment is received at invoice maturity.
        </p>
      </div>

        {/* 
          ACCESSIBILITY DESIGN (Issue #91):
          - We wrap the filter group in a <fieldset> with `aria-disabled="true"` to announce the preview/disabled 
            state to screen readers while keeping all controls discoverable in the tab order (unlike native `disabled`).
          - `aria-describedby` programmatically links the fieldset to the visible "Soon" badge, ensuring that 
            assistive technologies announce the "coming soon" status when users navigate to the filters.
          - We use a no-op handler structure (passing empty handlers) and CSS `pointer-events-none` to prevent
            interaction while keeping the controls focusable.
          - `opacity-60` is applied only to the inner controls container to ensure the "Soon" label itself stays
            fully opaque for maximum contrast (WCAG AA compliant).
        */}
        <fieldset 
          className="mb-8 rounded-xl border border-slate-800 bg-slate-900/30 p-6"
          aria-disabled="true"
          aria-describedby="filters-coming-soon"
        >
          <legend className="sr-only">Marketplace Filters</legend>
          <div id="filters-coming-soon" className="mb-4 inline-block rounded bg-slate-800 px-2 py-1 text-xs font-semibold tracking-wide text-slate-300">
            Soon: These filter controls are currently unavailable.
          </div>
          <div className="flex flex-wrap gap-4 items-center opacity-60 pointer-events-none">
            <InvoiceSearch 
              value={searchQuery} 
              onChange={/* no-op handler to keep it read-only but focusable */ () => {}} 
            />
            <InvoiceFilters
              filters={filters}
              onFilterChange={/* no-op handler to keep it read-only but focusable */ () => {}}
              onClearFilters={/* no-op handler to keep it read-only but focusable */ () => {}}
            />
          </div>
        </fieldset>

        {invoices === null ? (
          <InvoiceListSkeleton rows={3} />
        ) : invoices.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-8 text-center text-slate-500">
            No investable invoices. Connect wallet to see the marketplace.
          </div>
        ) : (
          <>
            <ul className="space-y-4">
              {invoices.map((inv) => (
                <li key={inv.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-slate-100">{inv.issuer}</span>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-cyan-900/60 text-cyan-300">
                      {inv.status}
                    </span>
                  </div>
                  <div className="flex gap-6 text-sm text-slate-400">
                    <span>{inv.currency}&nbsp;{inv.amount}</span>
                    <span>Est. yield&nbsp;{inv.yield}</span>
                    <span>Maturity&nbsp;{inv.dueDate}</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/30 p-4 text-sm text-slate-400">
              Note: Yield references are educational only and reflect on-chain basis-point assumptions. Invoice contracts settle at maturity.
            </div>
          </>
        )}
      </main>
    </div>
  );
}
