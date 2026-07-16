import "@testing-library/jest-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "./ToastProvider";
import { WalletProvider } from "./WalletContext";
import WalletStatus from "./WalletStatus";
import * as freighter from "../lib/wallet/freighter";

jest.mock("../lib/wallet/freighter");

function setup() {
  return userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
}

function renderWithProviders(ui) {
  return render(
    <ToastProvider>
      <WalletProvider>{ui}</WalletProvider>
    </ToastProvider>
  );
}

async function flushTimers(delayMs) {
  await act(async () => {
    jest.advanceTimersByTime(delayMs);
    await Promise.resolve();
  });
}

describe("WalletStatus", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("renders the initial disconnected state", () => {
    renderWithProviders(<WalletStatus />);

    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
    expect(
      screen.getByText(/connect your stellar wallet/i, { selector: "span" })
    ).toBeInTheDocument();
  });

  it("shows a connecting state and then a successful connection", async () => {
    const user = setup();
    freighter.isFreighterConnected.mockResolvedValue(true);
    freighter.connectFreighter.mockResolvedValue("GABC...XYZ123");
    freighter.getFreighterNetwork.mockResolvedValue("public");

    renderWithProviders(<WalletStatus />);
    const button = screen.getByRole("button", { name: /connect wallet/i });

    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText(/1,234\.56 XLM/, { selector: "span" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
    });
  });

  it("disconnects the wallet when the disconnect button is clicked", async () => {
    const user = setup();
    freighter.isFreighterConnected.mockResolvedValue(true);
    freighter.connectFreighter.mockResolvedValue("GABC...XYZ123");
    freighter.getFreighterNetwork.mockResolvedValue("public");

    renderWithProviders(<WalletStatus />);
    const connectButton = screen.getByRole("button", {
      name: /connect wallet/i,
    });
    await user.click(connectButton);

    const disconnectButton = await screen.findByRole("button", {
      name: /disconnect/i,
    });
    await user.click(disconnectButton);

    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
  });

  it("shows an error state and allows retry", async () => {
    const user = setup();
    freighter.isFreighterConnected.mockResolvedValue(true);
    freighter.connectFreighter.mockRejectedValue(new Error("User rejected connection"));

    renderWithProviders(<WalletStatus />);
    const button = screen.getByRole("button", { name: /connect wallet/i });
    await user.click(button);

    expect(await screen.findByRole("button", { name: /retry connection/i })).toBeInTheDocument();
  });

  it("shows a wrong network state and allows retry", async () => {
    const user = setup();
    freighter.isFreighterConnected.mockResolvedValue(true);
    freighter.connectFreighter.mockResolvedValue("GABC...XYZ123");
    freighter.assertExpectedNetwork.mockRejectedValue(
      new Error("Connected to public. Please switch to testnet.")
    );

    renderWithProviders(<WalletStatus />);
    const button = screen.getByRole("button", { name: /connect wallet/i });
    await user.click(button);

    expect(await screen.findByRole("button", { name: /switch network/i })).toBeInTheDocument();
  });

  it("shows a no-wallet state and opens the wallet installation page", async () => {
    const user = setup();
    const openSpy = jest.spyOn(window, "open").mockImplementation(() => {});
    freighter.isFreighterConnected.mockResolvedValue(false);

    renderWithProviders(<WalletStatus />);
    const button = screen.getByRole("button", { name: /connect wallet/i });
    await user.click(button);

    const installButton = await screen.findByRole("button", {
      name: /install wallet/i,
    });
    await user.click(installButton);
    expect(openSpy).toHaveBeenCalledWith(
      "https://www.stellar.org/wallets",
      "_blank",
      "noopener,noreferrer"
    );

    openSpy.mockRestore();
  });
});
