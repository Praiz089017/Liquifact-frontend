import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import WalletStatus from "./WalletStatus";
import {
  isFreighterConnected,
  connectFreighter,
  getFreighterNetwork,
} from "../lib/wallet/freighter";
import { ToastProvider } from "./ToastProvider";
import { WalletProvider } from "./WalletProvider";

jest.mock("../lib/wallet/freighter", () => ({
  isFreighterConnected: jest.fn(),
  connectFreighter: jest.fn(),
  getFreighterNetwork: jest.fn(),
  assertExpectedNetwork: jest.fn(),
}));

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

async function flushTimersTs(delayMs: number) {
  await act(async () => {
    jest.advanceTimersByTime(delayMs);
    await Promise.resolve();
  });
}

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

  it("renders a polite live region reflecting the initial wallet state", () => {
    renderWithProviders(<WalletStatus />);
    const region = screen.getByTestId("wallet-live-region");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("role", "status");
    // Initial state — shows current wallet status
    expect(region).toHaveTextContent(/disconnected/i);
  });

  it('announces "Wallet connected." after a successful connection', async () => {
    const user = setup();
    const { isFreighterConnected, connectFreighter, getFreighterNetwork } =
      require("../lib/wallet/freighter");
    (isFreighterConnected as jest.Mock).mockResolvedValue(true);
    (connectFreighter as jest.Mock).mockResolvedValue("GABC...XYZ123");
    (getFreighterNetwork as jest.Mock).mockResolvedValue("public");

    renderWithProviders(<WalletStatus />);
    const btn = screen.getByRole("button", { name: /connect wallet/i });
    await user.click(btn);

    const region = screen.getByTestId("wallet-live-region");
    await waitFor(() => expect(region).toHaveTextContent("Wallet connected."));
  });

  it('announces "Wallet disconnected." after disconnect', async () => {
    const user = setup();
    const { isFreighterConnected, connectFreighter, getFreighterNetwork } =
      require("../lib/wallet/freighter");
    (isFreighterConnected as jest.Mock).mockResolvedValue(true);
    (connectFreighter as jest.Mock).mockResolvedValue("GABC...XYZ123");
    (getFreighterNetwork as jest.Mock).mockResolvedValue("public");

    renderWithProviders(<WalletStatus />);
    await user.click(screen.getByRole("button", { name: /connect wallet/i }));

    // Now disconnect
    const disconnectBtn = await screen.findByRole("button", { name: /disconnect/i });
    await user.click(disconnectBtn);

    const region = screen.getByTestId("wallet-live-region");
    await waitFor(() => expect(region).toHaveTextContent("Wallet disconnected."));
  });

  it('announces "Wallet connection failed." on error state', async () => {
    const user = setup();
    const { isFreighterConnected, connectFreighter } =
      require("../lib/wallet/freighter");
    (isFreighterConnected as jest.Mock).mockResolvedValue(true);
    (connectFreighter as jest.Mock).mockRejectedValue(new Error("User rejected connection"));

    renderWithProviders(<WalletStatus />);
    await user.click(screen.getByRole("button", { name: /connect wallet/i }));

    const region = screen.getByTestId("wallet-live-region");
    await waitFor(() => expect(region).toHaveTextContent("Wallet connection failed."));
  });

  it("does not include the wallet public key in the live region announcement", async () => {
    const user = setup();
    const { isFreighterConnected, connectFreighter, getFreighterNetwork } =
      require("../lib/wallet/freighter");
    (isFreighterConnected as jest.Mock).mockResolvedValue(true);
    (connectFreighter as jest.Mock).mockResolvedValue("GABC...XYZ123");
    (getFreighterNetwork as jest.Mock).mockResolvedValue("public");

    renderWithProviders(<WalletStatus />);
    await user.click(screen.getByRole("button", { name: /connect wallet/i }));

    const region = screen.getByTestId("wallet-live-region");
    await waitFor(() => expect(region).toHaveTextContent("Wallet connected."));
    // Must not expose any part of the public key
    expect(region).not.toHaveTextContent(/GABC/i);
    expect(region).not.toHaveTextContent(/XYZ123/i);
  });
});

// ---------------------------------------------------------------------------

describe.skip("WalletStatus (direct import)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
    // Prevent WalletProvider auto-connect on mount
    (isFreighterConnected as jest.Mock).mockResolvedValue(false);
    if (typeof window !== "undefined") window.localStorage.clear();
  });

  const renderWithToast = (ui: React.ReactElement) => {
    return render(
      <ToastProvider>
        <WalletProvider>{ui}</WalletProvider>
      </ToastProvider>
    );
  };

  it("connects successfully", async () => {
    (isFreighterConnected as jest.Mock).mockResolvedValue(true);
    (connectFreighter as jest.Mock).mockResolvedValue("GABC...XYZ123");
    (getFreighterNetwork as jest.Mock).mockResolvedValue("testnet");

    renderWithToast(<WalletStatus />);

    // Initial state
    const connectBtn = screen.getByRole("button", { name: /Connect Wallet/i });
    fireEvent.click(connectBtn);

    // Connecting state
    expect(screen.getByRole("button", { name: /Connecting/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Disconnect Wallet/i })).toBeInTheDocument();
      // Should show truncated address
      expect(screen.getByText(/GABC\.\.\.XYZ123/)).toBeInTheDocument();
    });
  });

  it("shows error on user rejection", async () => {
    (isFreighterConnected as jest.Mock).mockResolvedValue(true);
    (connectFreighter as jest.Mock).mockRejectedValue(new Error("User rejected connection"));

    renderWithToast(<WalletStatus />);

    fireEvent.click(screen.getByRole("button", { name: /Connect Wallet/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Retry Connection/i })).toBeInTheDocument();
      const banner = screen.getByTestId("wallet-error-banner");
      expect(banner).toHaveTextContent(/User rejected connection/);
    });
  });

  it("shows wrong network when on public instead of testnet", async () => {
    (isFreighterConnected as jest.Mock).mockResolvedValue(true);
    (connectFreighter as jest.Mock).mockResolvedValue("GABC...XYZ123");
    (getFreighterNetwork as jest.Mock).mockResolvedValue("public");

    renderWithToast(<WalletStatus />);

    fireEvent.click(screen.getByRole("button", { name: /Connect Wallet/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Switch Network/i })).toBeInTheDocument();
      const banner = screen.getByTestId("wallet-error-banner");
      expect(banner).toHaveTextContent(/Connected to public. Please switch to testnet./);
    });
  });

  it("shows install button when wallet not found", async () => {
    (isFreighterConnected as jest.Mock).mockResolvedValue(false);

    renderWithToast(<WalletStatus />);

    fireEvent.click(screen.getByRole("button", { name: /Connect Wallet/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Install Freighter/i })).toBeInTheDocument();
    });
  });
});
