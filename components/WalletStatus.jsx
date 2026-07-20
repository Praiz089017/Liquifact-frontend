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

  /**
   * Maps each WALLET_STATE to the Button props and display config for that state.
   *
   * Config-to-prop mapping:
   *   config.buttonVariant → <Button variant={config.buttonVariant}>
   *     - "primary"   : DISCONNECTED / ERROR  — cyan, invites the user to act
   *     - "loading"   : CONNECTING (internal; Button receives loading=true instead)
   *     - "secondary" : CONNECTED             — muted, destructive-ish (disconnect)
   *     - "warning"   : WRONG_NETWORK         — amber, user needs to switch network
   *     - "external"  : NO_WALLET             — violet, opens an external install URL
   *
   *   loading derived separately: state === WALLET_STATES.CONNECTING
   *     → passed as <Button loading={…}> which renders a Spinner and sets aria-busy
   *
   *   config.disabled → <Button disabled={config.disabled}>
   *     - true only during CONNECTING (button is inert while the async flow runs)
   *
   * @param {string} currentState - One of the WALLET_STATES values.
   * @returns {{ buttonText: string, buttonVariant: string, helperText: string, disabled: boolean, showAddress: boolean }}
   */
  const getStateConfig = (currentState) => {
    switch (currentState) {
      case WALLET_STATES.DISCONNECTED:
        return {
          buttonText: copy.wallet.connectButton,
          // primary variant: cyan CTA, invites connection
          buttonVariant: "primary",
          helperText: copy.wallet.helperDisconnected,
          disabled: false,
          showAddress: false,
        };

      case WALLET_STATES.CONNECTING:
        return {
          buttonText: copy.wallet.connectingButton,
          // primary variant kept; loading=true (derived below) adds Spinner + aria-busy
          buttonVariant: "primary",
          helperText: copy.wallet.helperConnecting,
          disabled: true,
          showAddress: false,
        };

      case WALLET_STATES.CONNECTED:
        return {
          buttonText: copy.wallet.disconnectButton,
          // secondary variant: muted style signals a destructive (disconnect) action
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
          // primary variant: re-invites connection after failure
          buttonVariant: "primary",
          helperText: error || copy.wallet.helperError,
          disabled: false,
          showAddress: false,
        };

      case WALLET_STATES.WRONG_NETWORK:
        return {
          buttonText: copy.wallet.switchNetworkButton,
          // warning variant: amber alert, user must switch network
          buttonVariant: "warning",
          helperText: error || copy.wallet.helperWrongNetwork,
          disabled: false,
          showAddress: false,
        };

      case WALLET_STATES.NO_WALLET:
        return {
          buttonText: copy.wallet.installWalletButton,
          // external variant: violet, opens trusted install URL in new tab
          buttonVariant: "external",
          helperText: copy.wallet.helperNoWallet,
          disabled: false,
          showAddress: false,
        };

      default:
        return getStateConfig(WALLET_STATES.DISCONNECTED);
    }
  };

  /**
   * Resolved display config for the current wallet state.
   * buttonVariant → <Button variant={config.buttonVariant}>
   * loading       → derived as state === WALLET_STATES.CONNECTING
   */
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
