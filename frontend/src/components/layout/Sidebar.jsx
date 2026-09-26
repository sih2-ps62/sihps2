import { LogOut, Snowflake } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { navItems } from "../../data/navigation";
import { useAuth } from "../../context/AuthContext";
import NavList from "./NavList";

export default function Sidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="hidden shrink-0 border-r border-border bg-surface backdrop-blur-glass md:flex md:w-16 md:flex-col md:py-6 lg:w-60">
      <div className="mb-8 flex animate-fade-slide-up items-center gap-3 px-4 lg:px-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
          <Snowflake size={20} strokeWidth={1.75} />
        </div>
        <span className="hidden text-lg font-semibold tracking-wide text-text-primary lg:inline">
          POLAR<span className="text-accent">OPS</span>
        </span>
      </div>
      <NavList items={navItems} />
      <div className="mt-auto px-3 pt-4">
        <button
          type="button"
          onClick={handleLogout}
          className="focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors duration-200 hover:text-text-primary"
        >
          <LogOut size={20} strokeWidth={1.75} className="shrink-0" />
          <span className="hidden lg:inline">Sign out</span>
        </button>
      </div>
    </aside>
  );
}
