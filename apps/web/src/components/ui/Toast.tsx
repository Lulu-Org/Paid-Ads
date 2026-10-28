"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type ToastTone = "success" | "error";
type ToastItem = { id: number; message: string; tone: ToastTone };

const ToastContext = createContext<((message: string, tone?: ToastTone) => void) | null>(null);

// Pass an already translated message: toast(t("contacts.saved")).
export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast must be used inside <ToastProvider>");
  return show;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, tone: ToastTone = "success") => {
    setToasts((list) => [...list, { id: Date.now() + Math.random(), message, tone }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed right-4 bottom-4 z-[60] grid gap-2 sm:right-7 sm:bottom-6" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <ToastMessage key={toast.id} toast={toast} onDone={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastMessage({ toast, onDone }: { toast: ToastItem; onDone: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDone(toast.id), 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDone]);

  return (
    <div className="flex items-center gap-2.5 rounded-[9px] bg-[#29263e] px-3.5 py-3 text-[11px] text-white shadow-[0_10px_30px_#29263e36]">
      <span
        aria-hidden
        className={`grid size-[17px] place-items-center rounded-full text-[9px] font-black ${
          toast.tone === "success" ? "bg-[#63bf8c] text-[#143d2a]" : "bg-[#ee7968] text-[#4a1510]"
        }`}
      >
        {toast.tone === "success" ? "✓" : "!"}
      </span>
      {toast.message}
    </div>
  );
}
