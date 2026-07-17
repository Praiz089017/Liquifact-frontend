import "@testing-library/jest-dom";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import WalletStatus, { WALLET_STATES } from "../WalletStatus";
import { ToastProvider } from "../ToastProvider";
import { WalletProvider } from "../WalletProvider";

jest.mock("../../lib/wallet/freighter", () => ({
  isFreighterConnected: jest.fn(),
  connectFreighter: jest.fn(),
  getFreighterNetwork: jest.fn(),
  assertExpectedNetwork: jest.fn(),
}));

import {
  isFreighterConnected,
  connectFreighter,
  getFreighterNetwork,
  assertExpectedNetwork,
} from "../../lib/wallet/freighter";

function renderWalletStatus() {
  return render(
    <ToastProvider>
      <WalletProvider>
        <WalletStatus />
      </WalletProvider>
    </ToastProvider>
  );
}

function getWalletStatusRegion() {
  return screen.getAllByRole("status")[0];
}

function getToastRegion() {
  return screen.getAllByRole("status")[1];
}

beforeEach(() => {
  jest.useFakeTimers();
  if (typeof window !== "undefined") {
    window.localStorage.clear();
  }
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("WalletStatus — initial (disconnected) state", () => {
  it('renders "Connect Wallet" button when disconnected', () => {
    renderWalletStatus();
    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
  });

  it("sr-only status region reflects disconnected state", () => {
    renderWalletStatus();
    expect(getWalletStatusRegion()).toHaveTextContent("");
  });
});

describe("WalletStatus — DISCONNECTED → CONNECTING transition", () => {
  it("transitions to connecting state immediately on click", () => {
    isFreighterConnected.mockResolvedValue(true);

    renderWalletStatus();
    fireEvent.click(screen.getByRole("button", { name: /connect wallet/i }));
    expect(screen.getByRole("button", { name: /connecting/i })).toBeInTheDocument();
  });
});

describe("WalletStatus — CONNECTING → CONNECTED (success path)", () => {
  async function connectSuccessfully() {
    isFreighterConnected.mockResolvedValue(true);
    connectFreighter.mockResolvedValue("GABCDEFGHIJKLMNOPQRSTUVWXYZ123456");
    assertExpectedNetwork.mockResolvedValue(undefined);
    getFreighterNetwork.mockResolvedValue("testnet");

    renderWalletStatus();
    fireEvent.click(screen.getByRole("button", { name: /connect wallet/i }));

    await act(async () => {
      await Promise.resolve();
    });
  }

  afterEach(() => jest.restoreAllMocks());

  it('shows "Disconnect" button after successful connection', async () => {
    await connectSuccessfully();
    expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
  });
});

describe("WalletStatus — CONNECTING → ERROR (error path)", () => {
  async function connectWithError() {
    isFreighterConnected.mockResolvedValue(true);
    connectFreighter.mockRejectedValue(new Error("User rejected connection"));

    renderWalletStatus();
    const btn = screen.getByRole("button", { name: /connect wallet/i });
    fireEvent.click(btn);

    await act(async () => {
      await Promise.resolve();
    });
  }

  afterEach(() => jest.restoreAllMocks());

  it("shows error helper text", async () => {
    await connectWithError();
    const helperText = screen.getByText(/User rejected connection/i, {
      selector: "#wallet-helper-text",
    });
    expect(helperText).toBeInTheDocument();
  });

  it("fires an error toast on connection failure", async () => {
    await connectWithError();
    expect(within(getToastRegion()).getByText(/failed/i)).toBeInTheDocument();
  });
});
