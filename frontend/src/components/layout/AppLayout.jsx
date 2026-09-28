import { useCallback, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import CommandPalette from "../ui/CommandPalette";
import OfflineQueuePanel from "../ui/OfflineQueuePanel";
import AssistantPanel from "../ui/AssistantPanel";
import Sidebar from "./Sidebar";
import MobileDrawer from "./MobileDrawer";
import Topbar from "./Topbar";
import { navItems } from "../../data/navigation";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";

export default function AppLayout() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const location = useLocation();

  const openPalette = useCallback(() => setIsPaletteOpen(true), []);
  useKeyboardShortcuts({ onOpenCommandPalette: openPalette });

  const currentNav =
    navItems.find((item) =>
      item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path)
    ) ?? navItems[0];

  return (
    <div className="mx-auto flex min-h-screen max-w-content">
      <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} />
      <OfflineQueuePanel />
      <AssistantPanel />
      <Sidebar />
      <MobileDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={currentNav.title}
          subtitle={currentNav.subtitle}
          onOpenMenu={() => setIsDrawerOpen(true)}
          onOpenCommandPalette={openPalette}
        />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
