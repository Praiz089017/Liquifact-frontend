"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ErrorBanner from "@/components/ErrorBanner";
import InvoiceListSkeleton from "@/components/InvoiceListSkeleton";
import InvoiceSearch from "@/components/InvoiceSearch";
import InvoiceFilters, {
  ActiveFilterSummary,
  DEFAULT_FILTERS,
  clearFilterByKey,
  hasActiveFilters,
} from "@/components/InvoiceFilters";
import Pagination from "@/components/Pagination";
import { copy } from "../copy/en";
import { fetchInvestableInvoices } from "../../lib/api/invoices";
import { loadMockInvoices } from "./lib";

/**
 * Number of invoices rendered per page. Export allows tests to reference
 * the same constant without hard-coding a magic number.
 */
export const PAGE_SIZE = 10;

/** Debounce delay (ms) for issuer search filtering. */
export const SEARCH_DEBOUNCE_MS = 200;

/**
 * Returns the screen-reader announcement text for the initial invoice load.
 *
 * @param {Array} invoices - The resolved invoice array (may be empty).
 * @param {object} [options]
 * @param {boolean} [options.filterActive=false] - Whether a filter is applied.
 * @param {number} [options.filteredCount=0] - Number of invoices matching filters.
 * @returns {string}
 */
export function getInvoiceLoadAnnouncement(
  invoices,
  { filterActive = false, filteredCount = 0 } = {},
) {
  if (!Array.isArray(invoices) || invoices.length === 0) {
    return "No invoices available";
  }

  if (filterActive) {
    return filteredCount === 0
      ? "No invoices match"
      : `${filteredCount} of ${invoices.length} invoices match`;
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
 * Filters and sorts invoices based on search query and structured filters.
 *
 * @param {Array} invoices
 * @param {string} debouncedQuery
 * @param {typeof DEFAULT_FILTERS} filters
 * @returns {Array}
 */
export function filterInvoices(invoices, debouncedQuery, filters) {
  if (!Array.isArray(invoices)) return [];

  let result = invoices;

  if (debouncedQuery.trim()) {
    const q = debouncedQuery.trim().toLowerCase();
    result = result.filter((inv) => inv.issuer.toLowerCase().includes(q));
  }

  if (filters.yieldMin !== "") {
    const min = parseFloat(filters.yieldMin);
    if (!Number.isNaN(min)) {
      result = result.filter((inv) => {
        const y = parseFloat(inv.yield);
        return !Number.isNaN(y) && y >= min;
      });
    }
  }

  if (filters.yieldMax !== "") {
    const max = parseFloat(filters.yieldMax);
    if (!Number.isNaN(max)) {
      result = result.filter((inv) => {
        const y = parseFloat(inv.yield);
        return !Number.isNaN(y) && y <= max;
      });
    }
  }

  if (filters.currency) {
    result = result.filter((inv) => inv.currency === filters.currency);
  }

  if (filters.maturityFrom) {
    const from = new Date(filters.maturityFrom);
    result = result.filter((inv) => new Date(inv.dueDate) >= from);
  }

  if (filters.maturityTo) {
    const to = new Date(filters.maturityTo);
    result = result.filter((inv) => new Date(inv.dueDate) <= to);
  }

  if (filters.sort) {
    result = [...result].sort((a, b) => {
      switch (filters.sort) {
        case "yield_desc":
          return parseFloat(b.yield) - parseFloat(a.yield);
        case "yield_asc":
          return parseFloat(a.yield) - parseFloat(b.yield);
        case "amount_desc":
          return (
            parseFloat(b.amount.replace(/,/g, "")) -
            parseFloat(a.amount.replace(/,/g, ""))
          );
        case "amount_asc":
          return (
            parseFloat(a.amount.replace(/,/g, "")) -
            parseFloat(b.amount.replace(/,/g, ""))
          );
        case "maturity_asc":
          return new Date(a.dueDate) - new Date(b.dueDate);
        case "maturity_desc":
          return new Date(b.dueDate) - new Date(a.dueDate);
        default:
          return 0;
      }
    });
  }

  return result;
}

/**
 * InvestMarketplace — main component for the invest page.
 *
 * @param {object} props
 * @param {Function} [props.loadInvoices] - Async loader; injectable for testing.
 * @returns {JSX.Element}
 */
export function InvestMarketplace({ loadInvoices = fetchInvestableInvoices }) {
  const [invoices, setInvoices] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [paginationAnnouncement, setPaginationAnnouncement] = useState("");
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const loadMoreRef = useRef(null);

  const resetPagination = useCallback(() => {
    setVisibleCount(PAGE_SIZE);
    setPaginationAnnouncement("");
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const announceLoadCompletion = async () => {
      try {
        const nextInvoices = await loadInvoices({ signal: controller.signal });

        if (!isActive) return;

        const normalizedInvoices = Array.isArray(nextInvoices) ? nextInvoices : [];
        setInvoices(normalizedInvoices);
        setVisibleCount(PAGE_SIZE);
        setPaginationAnnouncement("");
        setLoadError("");
      } catch {
        if (!isActive) return;

        setInvoices([]);
        setLoadError(copy.invest.errorDescription);
        setPaginationAnnouncement("");
      }
    };

    void announceLoadCompletion();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [loadInvoices]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setVisibleCount(PAGE_SIZE);
      setPaginationAnnouncement("");
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredInvoices = useMemo(
    () => filterInvoices(invoices, debouncedQuery, filters),
    [invoices, debouncedQuery, filters],
  );

  const filterActive =
    hasActiveFilters(filters) || Boolean(debouncedQuery.trim());

  const filterStatusMessage = useMemo(() => {
    if (invoices === null) return "";
    if (loadError) return copy.invest.errorStatus;
    return getInvoiceLoadAnnouncement(invoices, {
      filterActive,
      filteredCount: filteredInvoices.length,
    });
  }, [invoices, loadError, filterActive, filteredInvoices.length]);

  const statusMessage = paginationAnnouncement || filterStatusMessage;

  const visibleInvoices = filteredInvoices.slice(0, visibleCount);

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => {
      const next = Math.min(prev + PAGE_SIZE, filteredInvoices.length);
      setPaginationAnnouncement(getPaginationAnnouncement(next, filteredInvoices.length));
      return next;
    });

    setTimeout(() => {
      loadMoreRef.current?.focus();
    }, 0);
  }, [filteredInvoices.length]);

  const handleFilterChange = useCallback((nextFilters) => {
    setFilters(nextFilters);
    resetPagination();
  }, [resetPagination]);

  const handleRemoveFilter = useCallback(
    (clearKey) => {
      if (clearKey === "search") {
        setSearchQuery("");
        setDebouncedQuery("");
      } else {
        setFilters((prev) => clearFilterByKey(prev, clearKey));
      }
      resetPagination();
    },
    [resetPagination],
  );

  const handleClearAllFilters = useCallback(() => {
    setSearchQuery("");
    setDebouncedQuery("");
    setFilters(DEFAULT_FILTERS);
    resetPagination();
  }, [resetPagination]);

  const handleClearStructuredFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    resetPagination();
  }, [resetPagination]);

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

        <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900/30 p-6">
          <div className="flex flex-wrap gap-4 items-center">
            <InvoiceSearch value={searchQuery} onChange={setSearchQuery} />
            <InvoiceFilters
              filters={filters}
              onFilterChange={handleFilterChange}
              onClearFilters={handleClearStructuredFilters}
            />
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
        ) : filteredInvoices.length === 0 ? (
          <>
            <ActiveFilterSummary
              shown={0}
              totalFiltered={0}
              filters={filters}
              searchQuery={debouncedQuery}
              onRemoveFilter={handleRemoveFilter}
              onClearAll={handleClearAllFilters}
            />
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-8 text-center text-slate-300">
              No invoices match your filters.
            </div>
          </>
        ) : (
          <>
            <ActiveFilterSummary
              shown={visibleInvoices.length}
              totalFiltered={filteredInvoices.length}
              filters={filters}
              searchQuery={debouncedQuery}
              onRemoveFilter={handleRemoveFilter}
              onClearAll={handleClearAllFilters}
            />

            <ul className="space-y-4" aria-label="Investable invoices">
              {visibleInvoices.map((inv) => (
                <li key={inv.id}>
                  <Link
                    href={`/invest/${inv.id}`}
                    className="block rounded-xl border border-slate-800 bg-slate-900/50 p-5 hover:border-cyan-500/50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                    aria-label={`View details for ${inv.issuer} invoice ${inv.id}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-slate-100">{inv.issuer}</span>
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-cyan-900/60 text-cyan-300">
                        {inv.status}
                      </span>
                    </div>
                    <div className="flex gap-6 text-sm text-slate-300">
                      <span>
                        {inv.currency}&nbsp;{inv.amount}
                      </span>
                      <span>Est. yield&nbsp;{inv.yield}</span>
                      <span>Maturity&nbsp;{inv.dueDate}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            <Pagination
              ref={loadMoreRef}
              shown={visibleInvoices.length}
              total={filteredInvoices.length}
              onLoadMore={handleLoadMore}
            />

            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/30 p-4 text-sm text-slate-300">
              Note: Yield references are educational only and reflect on-chain basis-point
              assumptions. Invoice contracts settle at maturity.
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function InvestPage() {
  return <InvestMarketplace loadInvoices={loadMockInvoices} />;
}
