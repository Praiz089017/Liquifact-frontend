/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { ToastProvider } from "./ToastProvider";
import { WalletProvider, useWallet } from "./WalletProvider";
import WalletStatus from "./WalletStatus";
import { copy } from "../app/copy/en";

// Mock freighter so connect() works within WalletProvider
jest.mock("../lib/wallet/freighter", () => ({
  isFreighterConnected: jest.fn(),
  connectFreighter: jest.fn(),
  getFreighterNetwork: jest.fn(),
  assertExpectedNetwork: jest.fn(),
}));

import { isFreighterConnected } from "../lib/wallet/freighter";

function TestHarness() {
  const { state } = useWallet();
  return (
    <div>
      <div data-testid="wallet-state">{state}</div>
      <WalletStatus />
    </div>
  );
}

function renderWithProviders() {
  return render(
    <ToastProvider>
      <WalletProvider>
        <TestHarness />
      </WalletProvider>
    </ToastProvider>
  );
}

describe("WalletStatus external navigation", () => {
  let openSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let originalUrl: string;

  beforeEach(() => {
    jest.useFakeTimers();
    openSpy = jest.spyOn(window, "open").mockImplementation();
    errorSpy = jest.spyOn(console, "error").mockImplementation();
    originalUrl = copy.wallet.installWalletUrl;
    (isFreighterConnected as jest.Mock).mockResolvedValue(false); // no wallet installed
  });

  afterEach(() => {
    copy.wallet.installWalletUrl = originalUrl;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function connectToReachNoWalletState() {
    renderWithProviders();
    const button = screen.getByRole("button", { name: /connect wallet/i });

    fireEvent.click(button);

    // Allow the async connect flow to resolve
    await act(async () => {
      await Promise.resolve();
    });
  }

  it("opens the trusted wallet URL with noopener and noreferrer", async () => {
    await connectToReachNoWalletState();

    const installButton = screen.getByRole("button", { name: /install/i });
    fireEvent.click(installButton);

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(
      copy.wallet.installWalletUrl,
      "_blank",
      "noopener,noreferrer"
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("blocks an insecure (http) URL and logs an error", async () => {
    copy.wallet.installWalletUrl = "http://insecure-wallet-site.com";
    await connectToReachNoWalletState();

    const installButton = screen.getByRole("button", { name: /install/i });
    fireEvent.click(installButton);

    expect(openSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });
});
