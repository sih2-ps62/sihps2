import { useEffect, useRef } from "react";
import { LogOut, Snowflake, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { navItems } from "../../data/navigation";
import { useAuth } from "../../context/AuthContext";
import NavList from "./NavList";

export default function MobileDrawer({ isOpen, onClose }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const closeButtonRef = useRef(null);
  const triggerElRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    triggerElRef.current = document.activeElement;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
      triggerElRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleLogout = () => {
    onClose();
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
      <button
        type="button"
        aria-label="Close navigation menu"
        onClick={onClose}
        className="absolute inset-0 bg-text-primary/40 backdrop-blur-sm"
      />
      <div className="relative flex h-full w-72 max-w-[80vw] flex-col border-r border-border bg-surface-solid py-6 shadow-glass-hover animate-fade-slide-up">
        <div className="mb-8 flex items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
              <Snowflake size={20} strokeWidth={1.75} />
            </div>
            <span className="text-lg font-semibold tracking-wide text-text-primary">
              POLAR<span className="text-accent">OPS</span>
            </span>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:text-text-primary"
          >
            <X size={20} strokeWidth={1.75} />
          </button>
        </div>
        <NavList items={navItems} forceLabels onNavigate={onClose} />
        <div className="mt-auto px-3 pt-4">
          <button
            type="button"
            onClick={handleLogout}
            className="focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors duration-200 hover:text-text-primary"
          >
            <LogOut size={20} strokeWidth={1.75} className="shrink-0" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
