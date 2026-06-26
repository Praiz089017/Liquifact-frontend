import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import Home from './page';

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

jest.mock('../components/WalletStatusLazy', () => ({
  __esModule: true,
  default: function MockWalletStatusLazy() {
    return <button type="button">Connect Wallet</button>;
  },
}));

jest.mock('next/link', () => {
  function MockLink({ href, children, ...props }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  }
  return {
    __esModule: true,
    default: MockLink,
  };
});

afterEach(() => {
  jest.restoreAllMocks();
});

function mockFetchOnce(responseBody, ok = true) {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok,
    json: jest.fn().mockResolvedValueOnce(responseBody),
  });
}

async function clickCheckHealth() {
  fireEvent.click(
    screen.getByRole('button', { name: /check backend health/i }),
  );
  await waitFor(() =>
    expect(screen.queryByText(/checking/i)).not.toBeInTheDocument(),
  );
}

describe('Home health render', () => {
  function getStructuredSummary() {
    return document.querySelector('[class*="space-y-1"]');
  }

  it('renders recognized fields in a structured summary', async () => {
    mockFetchOnce({ status: 'ok', message: 'All good', version: '1.2.3' });
    render(<Home />);

    await clickCheckHealth();

    const summary = getStructuredSummary();
    expect(within(summary).getByText(/status:/i)).toBeInTheDocument();
    expect(within(summary).getByText(/ok/i)).toBeInTheDocument();
    expect(within(summary).getByText(/message:/i)).toBeInTheDocument();
    expect(within(summary).getByText(/All good/i)).toBeInTheDocument();
    expect(within(summary).getByText(/version:/i)).toBeInTheDocument();
    expect(within(summary).getByText(/1\.2\.3/i)).toBeInTheDocument();
  });

  it('omits recognized fields that are missing', async () => {
    mockFetchOnce({ status: 'ok' });
    render(<Home />);

    await clickCheckHealth();

    const summary = getStructuredSummary();
    expect(within(summary).getByText(/status:/i)).toBeInTheDocument();
    expect(within(summary).queryByText(/message:/i)).not.toBeInTheDocument();
    expect(within(summary).queryByText(/version:/i)).not.toBeInTheDocument();
  });

  it('renders raw payload inside a collapsed details element', async () => {
    mockFetchOnce({ status: 'ok', message: 'healthy' });
    render(<Home />);

    await clickCheckHealth();

    const details = document.querySelector('details');
    expect(details).toBeInTheDocument();
    expect(details).not.toHaveAttribute('open');

    expect(screen.getByText(/raw response/i)).toBeInTheDocument();
  });

  it('renders payload as text content, not HTML', async () => {
    mockFetchOnce({ status: 'ok' });
    render(<Home />);

    await clickCheckHealth();

    const pre = document.querySelector('pre');
    expect(pre).toBeInTheDocument();
    expect(pre).not.toHaveAttribute('dangerouslySetInnerHTML');
  });

  it('truncates payloads that are longer than the default limit', async () => {
    const largePayload = {
      status: 'ok',
      data: 'x'.repeat(5000),
    };
    mockFetchOnce(largePayload);
    render(<Home />);

    await clickCheckHealth();

    const pre = document.querySelector('pre');
    expect(pre.textContent).toMatch(/…\(truncated\)$/);
  });

  it('handles deeply nested payloads without error', async () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: 'deep' } } } } } } };
    mockFetchOnce(deep);
    render(<Home />);

    await clickCheckHealth();

    const pre = document.querySelector('pre');
    expect(pre.textContent).toContain('[Depth limit reached]');
  });

  it('handles a normal healthy payload end-to-end', async () => {
    mockFetchOnce({ status: 'ok', message: 'healthy', version: '2.0.0' });
    render(<Home />);

    await clickCheckHealth();

    const summary = getStructuredSummary();
    expect(within(summary).getByText(/status:/i)).toBeInTheDocument();
    expect(within(summary).getByText(/ok/i)).toBeInTheDocument();
    expect(within(summary).getByText(/healthy/i)).toBeInTheDocument();
    expect(within(summary).getByText(/version:/i)).toBeInTheDocument();
    expect(within(summary).getByText(/2\.0\.0/i)).toBeInTheDocument();
  });

  it('does not render health section before check', () => {
    render(<Home />);

    expect(screen.queryByText(/status:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/raw response/i)).not.toBeInTheDocument();
  });
});
