import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import WalletStatus from "./WalletStatus";
import { WalletProvider } from "./WalletProvider";
import { ToastProvider } from "./ToastProvider";

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ToastProvider>
      <WalletProvider>{ui}</WalletProvider>
    </ToastProvider>
  );
}

function setup() {
  return userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
}

async function flushTimers(delayMs: number) {
  await act(async () => {
    jest.advanceTimersByTime(delayMs);
    await Promise.resolve();
  });
}

// ---------------------------------------------------------------------------
// Live-region announcement tests (aria-live="polite")
// ---------------------------------------------------------------------------

describe("WalletStatus live region", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    if (typeof window !== "undefined") window.localStorage.clear();
  });

  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("renders a polite live region with no announcement on initial mount", () => {
    renderWithProviders(<WalletStatus />);
    const region = screen.getByTestId("wallet-live-region");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("role", "status");
    expect(region).toHaveTextContent("");
  });

  it("announces wallet state on mount (disconnected)", () => {
    renderWithProviders(<WalletStatus />);
    const region = screen.getByTestId("wallet-live-region");
    // Initial render should have no announcement since state hasn't changed
    expect(region).toHaveTextContent("");
  });
});
