'use client';

import { useEffect, useMemo, useState } from 'react';
import ErrorBanner from '../../components/ErrorBanner';
import InvoiceListSkeleton from '../../components/InvoiceListSkeleton';
import { copy } from '../copy/en';
import { fetchInvestableInvoices } from '../lib/api/invoices';

const INVOICE_STATUSES = {
  PENDING_TOKENIZATION: 'Pending tokenization',
  TOKENIZED: 'Tokenized',
  FUNDED: 'Funded',
  SETTLED: 'Settled',
};

const STATUS_STYLES = {
  [INVOICE_STATUSES.PENDING_TOKENIZATION]:
    'bg-amber-500/10 text-amber-200 ring-1 ring-amber-400/20',
  [INVOICE_STATUSES.TOKENIZED]:
    'bg-cyan-500/10 text-cyan-200 ring-1 ring-cyan-400/20',
  [INVOICE_STATUSES.FUNDED]:
    'bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/20',
  [INVOICE_STATUSES.SETTLED]:
    'bg-slate-800/80 text-slate-200 ring-1 ring-slate-500/20',
};

const MOCK_INVOICES = [
  {
    id: 'inv-1001',
    issuer: 'Test Supplier',
    amount: '12,500',
    currency: 'USD',
    dueDate: '2026-06-15',
    yield: '8.2%',
    status: INVOICE_STATUSES.TOKENIZED,
  },
  {
    id: 'inv-1002',
    issuer: 'Another LLC',
    amount: '7,800',
    currency: 'EUR',
    dueDate: '2026-07-01',
    yield: '7.5%',
    status: INVOICE_STATUSES.SETTLED,
  },
];

// DEV-only delay (ms) to make the skeleton visible during local development.
const DEV_DELAY = process.env.NODE_ENV === "development" ? 1500 : 0;

export function getInvoiceLoadAnnouncement(
  invoices,
  { filterActive = false, filteredCount = 0 } = {}
) {
  if (!Array.isArray(invoices) || invoices.length === 0) {
    return "No invoices available";
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [invoices, setInvoices] = useState(null); // null = loading
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [statusMessage, setStatusMessage] = useState("");
  const [paginationAnnouncement, setPaginationAnnouncement] = useState("");
  const [loadError, setLoadError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const initialSearch = searchParams.get("search") || "";
  const initialFilters = { ...DEFAULT_FILTERS };
  for (const key of Object.keys(DEFAULT_FILTERS)) {
    if (searchParams.has(key)) {
      initialFilters[key] = searchParams.get(key) || "";
    }
  }

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [debouncedQuery, setDebouncedQuery] = useState(initialSearch);
  const [filters, setFilters] = useState(initialFilters);

  /** Ref forwarded to the "Load more" button for focus management. */
  const loadMoreRef = useRef(null);

  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;

    async function load() {
      setInvoices(null);
      setLoadError('');

      try {
        const result = await loadInvoices();
        if (!active) return;

        setInvoices(normalizedInvoices);
        setVisibleCount(PAGE_SIZE);
      } catch {
        if (!isActive) return;

        setInvoices(null);
        setLoadError(copy.invest.errorDescription);
        setStatusMessage(copy.invest.errorStatus);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [loadInvoices]);

  const statusMessage = loadError
    ? 'Invoice list failed to load.'
    : (invoices === null ? 'Loading invoices.' : getInvoiceAnnouncement(mergedInvoices));

  if (loadError) {
    return (
      <div className="space-y-6">
        <ErrorBanner
          title={copy.invoices.errorTitle || 'Unable to load invoices'}
          description={loadError}
          previewLabel="Invoice list status"
        />
        <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {statusMessage}
        </p>
      </div>
    );
  }

  return (
    <section aria-labelledby="invoice-list-heading" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 id="invoice-list-heading" className="text-xl font-semibold text-slate-100">
            Your invoices
          </h2>
          <p className="text-sm text-slate-400">
            Track tokenization progress for uploaded documents.
          </p>
        </div>
        <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {statusMessage}
        </p>
      </div>

      {invoices === null && mergedInvoices.length === 0 ? (
        <InvoiceListSkeleton rows={3} />
      ) : mergedInvoices.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-10 text-center text-slate-300">
          {copy.invoices.emptyState}
        </div>
      ) : (
        <ul className="space-y-4">
          {mergedInvoices.map((invoice) => {
            const statusValue =
              invoice.status in STATUS_STYLES
                ? invoice.status
                : INVOICE_STATUSES.PENDING_TOKENIZATION;
            return (
              <li
                key={invoice.id}
                className="rounded-3xl border border-slate-800 bg-slate-900/50 p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-[0.14em] text-slate-500">
                      Invoice
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-100">
                      {invoice.issuer}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${STATUS_STYLES[statusValue]
                      }`}
                  >
                    {statusValue}
                  </span>
                </div>

                <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">
                      Amount
                    </dt>
                    <dd className="mt-2 text-sm text-slate-200">
                      {invoice.currency} {invoice.amount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">
                      Estimated yield
                    </dt>
                    <dd className="mt-2 text-sm text-slate-200">{invoice.yield}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">
                      Due date
                    </dt>
                    <dd className="mt-2 text-sm text-slate-200">{invoice.dueDate}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">
                      Reference
                    </dt>
                    <dd className="mt-2 text-sm text-slate-200">{invoice.id}</dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
