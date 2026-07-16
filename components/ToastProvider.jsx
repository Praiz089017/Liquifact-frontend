'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);
const AUTO_DISMISS_MS = 5000;

const VARIANT_STYLES = {
  success: {
    base: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
    accent: 'text-emerald-300',
    icon: '✅',
    label: 'Success',
  },
  error: {
    base: 'border-red-500/30 bg-red-500/10 text-red-100',
    accent: 'text-red-300',
    icon: '❌',
    label: 'Error',
  },
  info: {
    base: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-100',
    accent: 'text-cyan-300',
    icon: 'ℹ️',
    label: 'Info',
  },
};

function createToast({ variant = 'info', title, message }) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    variant,
    title: title || VARIANT_STYLES[variant]?.label || 'Notice',
    message,
    autoDismiss: true,
  };
}

function canReceiveFocus(el) {
  return (
    el instanceof HTMLElement &&
    typeof el.focus === 'function' &&
    !el.hasAttribute('disabled') &&
    el.isConnected
  );
}

function restoreFocusTo(el) {
  if (!canReceiveFocus(el)) return;
  queueMicrotask(() => {
    if (canReceiveFocus(el)) {
      el.focus();
    }
  });
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const triggerRef = useRef(null);
  const toastsCountRef = useRef(0);
  const pendingUserDismissRef = useRef(false);

  useEffect(() => {
    toastsCountRef.current = toasts.length;
  }, [toasts.length]);

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timeout = timers.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timers.current.delete(id);
    }
  }, []);

  const dismissToast = useCallback(
    (id, { restoreFocus = false } = {}) => {
      if (restoreFocus) {
        pendingUserDismissRef.current = true;
      }
      removeToast(id);
    },
    [removeToast],
  );

  const addToast = useCallback(({ variant, title, message }) => {
    if (toastsCountRef.current === 0) {
      const active = document.activeElement;
      if (canReceiveFocus(active) && active !== document.body) {
        triggerRef.current = active;
      }
    }
    setToasts((current) => [createToast({ variant, title, message }), ...current]);
  }, []);

  const pauseToast = useCallback((id) => {
    const timeout = timers.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timers.current.delete(id);
    }
  }, []);

  const resumeToast = useCallback(
    (id) => {
      if (timers.current.has(id)) {
        return;
      }
      setToasts((current) => {
        const toastExists = current.some((toast) => toast.id === id);
        if (!toastExists) return current;
        const timeout = setTimeout(() => dismissToast(id), AUTO_DISMISS_MS);
        timers.current.set(id, timeout);
        return current;
      });
    },
    [dismissToast],
  );

  useEffect(() => {
    const currentTimers = timers.current;

    toasts.forEach((toast) => {
      if (!toast.autoDismiss || currentTimers.has(toast.id)) {
        return;
      }
      const timeout = setTimeout(() => dismissToast(toast.id), AUTO_DISMISS_MS);
      currentTimers.set(toast.id, timeout);
    });

    return () => {
      currentTimers.forEach((timeout) => clearTimeout(timeout));
      currentTimers.clear();
    };
  }, [dismissToast, toasts]);

  // Restores focus to the trigger element exactly once, after the LAST toast
  // is dismissed by a user action (Close click or Escape). Timer-driven
  // auto-dismiss never sets `pendingUserDismissRef`, so focus is not stolen
  // back when a toast quietly fades out.
  useEffect(() => {
    if (toasts.length !== 0) return;
    if (!pendingUserDismissRef.current) return;
    if (!triggerRef.current) return;
    pendingUserDismissRef.current = false;
    const el = triggerRef.current;
    triggerRef.current = null;
    restoreFocusTo(el);
  }, [toasts]);

  useEffect(() => {
    if (toasts.length === 0) return;

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      const newest = toasts[0];
      if (!newest) return;
      event.preventDefault();
      dismissToast(newest.id, { restoreFocus: true });
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dismissToast, toasts]);

  const value = useMemo(
    () => ({
      success: (message, title) => addToast({ variant: 'success', title, message }),
      error: (message, title) => addToast({ variant: 'error', title, message }),
      info: (message, title) => addToast({ variant: 'info', title, message }),
    }),
    [addToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        aria-live="polite"
        role="status"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:justify-end sm:px-6"
      >
        <div className="flex w-full max-w-md flex-col gap-3">
          {toasts.map((toast) => {
            const variant = VARIANT_STYLES[toast.variant] || VARIANT_STYLES.info;

            return (
              <div
                key={toast.id}
                onMouseEnter={() => pauseToast(toast.id)}
                onMouseLeave={() => resumeToast(toast.id)}
                className={`pointer-events-auto overflow-hidden rounded-3xl border p-4 shadow-2xl shadow-slate-950/30 transition duration-200 ${variant.base}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-xl" aria-hidden="true">
                    {variant.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-100">{toast.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">{toast.message}</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-slate-700/80 bg-slate-950/70 px-2.5 py-1 text-xs font-semibold text-slate-100 outline-none transition duration-150 hover:bg-slate-900 focus-visible:ring-2 focus-visible:ring-cyan-400"
                    aria-label="Dismiss notification"
                    onClick={() => dismissToast(toast.id, { restoreFocus: true })}
                  >
                    Close
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
