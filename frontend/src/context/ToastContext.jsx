import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

const ToastContext = createContext(null);
let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message, { variant = "success", duration = 3500 } = {}) => {
      const id = idCounter++;
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[2000] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="glass-card animate-fade-slide-up pointer-events-auto flex items-center gap-2.5 border bg-surface-solid px-4 py-3 text-sm font-medium shadow-glass-hover"
          >
            {toast.variant === "error" ? (
              <XCircle size={18} strokeWidth={1.75} className="shrink-0 text-status-critical" />
            ) : (
              <CheckCircle2 size={18} strokeWidth={1.75} className="shrink-0 text-status-ok" />
            )}
            <span className="text-text-primary">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider.");
  return ctx;
}
