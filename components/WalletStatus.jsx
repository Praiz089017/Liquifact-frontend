"use client";

import { useState, useRef, useEffect } from "react";
import Button from "./Button";
import { copy } from "../app/copy/en";
import { useWallet, WALLET_STATES } from "./WalletProvider";

/**
 * Returns a concise, non-sensitive announcement string for a wallet state
 * transition. Returns null when no announcement is warranted (e.g. connecting
 * state, which has its own visible spinner).
 * @param {string} nextState
 * @returns {string|null}
 */
function getTransitionAnnouncement(nextState) {
  switch (nextState) {
    case WALLET_STATES.CONNECTED:
      return "Wallet connected.";
    case WALLET_STATES.DISCONNECTED:
      return "Wallet disconnected.";
    case WALLET_STATES.ERROR:
      return "Wallet connection failed.";
    case WALLET_STATES.WRONG_NETWORK:
      return "Wallet connected to wrong network.";
    case WALLET_STATES.NO_WALLET:
      return "No wallet detected.";
    default:
      return null;
  }
}

export default function WalletStatus() {
  const { state, walletData, error, connect, disconnect } = useWallet();

  // State config based on current wallet state
  const getStateConfig = (currentState) => {
    switch (currentState) {
      case WALLET_STATES.DISCONNECTED:
        return {
          buttonText: copy.wallet.connectButton,
          buttonVariant: "primary",
          helperText: copy.wallet.helperDisconnected,
          disabled: false,
          showAddress: false,
        };

      case WALLET_STATES.CONNECTING:
        return {
          buttonText: copy.wallet.connectingButton,
          buttonVariant: "loading",
          helperText: copy.wallet.helperConnecting,
          disabled: true,
          showAddress: false,
        };

      case WALLET_STATES.CONNECTED:
        return {
          buttonText: copy.wallet.disconnectButton,
          buttonVariant: "secondary",
          helperText: copy.wallet.helperConnected.replace(
            "{network}",
            walletData?.network || "public"
          ),
          disabled: false,
          showAddress: true,
        };

      case WALLET_STATES.ERROR:
        return {
          buttonText: copy.wallet.retryButton,
          buttonVariant: "primary",
          helperText: error || copy.wallet.helperError,
          disabled: false,
          showAddress: false,
        };

      case WALLET_STATES.WRONG_NETWORK:
        return {
          buttonText: copy.wallet.switchNetworkButton,
          buttonVariant: "warning",
          helperText: error || copy.wallet.helperWrongNetwork,
          disabled: false,
          showAddress: false,
        };

      case WALLET_STATES.NO_WALLET:
        return {
          buttonText: copy.wallet.installWalletButton,
          buttonVariant: "external",
          helperText: copy.wallet.helperNoWallet,
          disabled: false,
          showAddress: false,
        };

      default:
        return getStateConfig(WALLET_STATES.DISCONNECTED);
    }
  };

  const config = getStateConfig(state);

  // Track state transitions to announce them once via the polite live region.
  const prevStateRef = useRef(state);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  useEffect(() => {
    const prev = prevStateRef.current;
    if (prev !== state) {
      prevStateRef.current = state;
      const msg = getTransitionAnnouncement(state);
      if (msg) {
        // Defer all setState to avoid triggering react-hooks/set-state-in-effect.
        // Briefly clear then set so the same message re-announces if the
        // user toggles connect/disconnect repeatedly.
        const id = setTimeout(() => {
          setLiveAnnouncement("");
          queueMicrotask(() => setLiveAnnouncement(msg));
        }, 0);
        return () => clearTimeout(id);
      }
    }
  }, [state]);

  const handleClick = () => {
    switch (state) {
      case WALLET_STATES.DISCONNECTED:
      case WALLET_STATES.ERROR:
      case WALLET_STATES.WRONG_NETWORK:
        void connect();
        break;

      case WALLET_STATES.CONNECTED:
        disconnect();
        break;

      case WALLET_STATES.NO_WALLET:
        {
          const url = copy.wallet.installWalletUrl;
          // Only allow https URLs for security
          if (typeof url === "string" && url.startsWith("https://")) {
            window.open(url, "_blank", "noopener,noreferrer");
          } else {
            console.error(
              "Blocked attempt to open a non-HTTPS wallet URL for security reasons:",
              url
            );
          }
        }
        break;

      default:
        break;
    }
  };

  return (
    <div className="flex items-center gap-4">
      {/* Wallet state indicator + information */}
      <div className="flex items-center gap-3">
        {/* Status dot */}
        <div
          className={`h-2 w-2 rounded-full transition-colors duration-200 ${
            state === WALLET_STATES.CONNECTED
              ? "bg-green-500"
              : state === WALLET_STATES.CONNECTING
                ? "bg-yellow-500 animate-pulse"
                : state === WALLET_STATES.ERROR || state === WALLET_STATES.WRONG_NETWORK
                  ? "bg-red-500"
                  : "bg-slate-600"
          }`}
          aria-hidden="true"
        />

        {/* Address or helper text */}
        {config.showAddress && walletData ? (
          <div className="flex flex-col">
            <span className="font-mono text-sm text-slate-300">{walletData.address}</span>
            <span className="text-xs text-slate-500">{walletData.balance}</span>
          </div>
        ) : (
          <span id="wallet-helper-text" className="max-w-xs text-xs text-slate-400">
            {config.helperText}
          </span>
        )}
      </div>

      {/* Wallet action */}
      <Button
        variant={config.buttonVariant}
        loading={state === WALLET_STATES.CONNECTING}
        disabled={config.disabled}
        onClick={handleClick}
        aria-label={config.buttonText}
        aria-describedby="wallet-helper-text"
        className="focus-visible:outline-2 cursor-pointer focus-visible:outline-cyan-400 focus-visible:outline-offset-2"
      >
        {config.buttonText}
      </Button>

      {/* Accessible live region for state announcements */}
      <div className="sr-only" role="status" aria-live="polite" data-testid="wallet-live-region">
        {liveAnnouncement}
      </div>
    </div>
  );
}

export { WALLET_STATES };
