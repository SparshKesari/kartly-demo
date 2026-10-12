"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type Toast = { id: number; message: string; tone: "success" | "error" | "info" };

type AppContextValue = {
  cartCount: number;
  setCartCount: (n: number) => void;
  toast: (message: string, tone?: Toast["tone"]) => void;
  user: { id: string; name: string } | null;
};

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <Providers>");
  return ctx;
}

export function Providers({
  children,
  initialCartCount,
  user,
}: {
  children: ReactNode;
  initialCartCount: number;
  user: { id: string; name: string } | null;
}) {
  const [cartCount, setCartCount] = useState(initialCartCount);
  const [toastState, setToastState] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCartCount(initialCartCount);
  }, [initialCartCount]);

  const toast = useCallback((message: string, tone: Toast["tone"] = "success") => {
    if (timer.current) clearTimeout(timer.current);
    setToastState({ id: Date.now(), message, tone });
    timer.current = setTimeout(() => setToastState(null), 5000);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const toneClass =
    toastState?.tone === "error" ? "bg-red-700" : toastState?.tone === "info" ? "bg-slate-800" : "bg-emerald-700";

  return (
    <AppContext.Provider value={{ cartCount, setCartCount, toast, user }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
        {toastState && (
          <div
            key={toastState.id}
            data-testid="toast"
            role="status"
            className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-md px-4 py-3 text-sm font-medium text-white shadow-lg ${toneClass}`}
          >
            <span className="flex-1">{toastState.message}</span>
            <button
              type="button"
              aria-label="Dismiss notification"
              className="-my-1 -mr-2 min-h-[40px] min-w-[40px] rounded text-white/80 hover:text-white"
              onClick={() => setToastState(null)}
            >
              ×
            </button>
          </div>
        )}
      </div>
    </AppContext.Provider>
  );
}
