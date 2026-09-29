import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function Modal({ isOpen, onClose, title, children }) {
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return undefined;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", handleKeyDown);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
    // Only re-run when the modal opens/closes — not when the caller passes
    // a new inline `onClose` reference on every re-render (e.g. while the
    // user is typing in a form inside the modal), which was stealing focus
    // back to the close button on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1500] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Dismiss dialog"
        onClick={onClose}
        className="absolute inset-0 bg-text-primary/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md animate-fade-slide-up rounded-2xl border border-border bg-surface-solid p-6 shadow-glass-hover">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:text-text-primary"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
