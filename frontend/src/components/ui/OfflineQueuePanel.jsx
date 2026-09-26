import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { getBlackoutState, retryQueueItem, subscribeBlackout } from "../../lib/api";

const LABEL_RULES = [
  { test: (m, u) => /\/personnel\/.+\/checkin$/.test(u), label: "Personnel check-in" },
  { test: (m, u) => m === "POST" && u === "/personnel", label: "Personnel added" },
  { test: (m, u) => m === "PATCH" && u.startsWith("/personnel/"), label: "Personnel update" },
  { test: (m, u) => m === "POST" && u === "/emergencies", label: "Emergency incident reported" },
  { test: (m, u) => m === "PATCH" && u.startsWith("/emergencies/"), label: "Emergency status update" },
  { test: (m, u) => m === "POST" && u === "/inventory", label: "Inventory item created" },
  { test: (m, u) => m === "PATCH" && u.startsWith("/inventory/"), label: "Inventory adjustment" },
  { test: (m, u) => m === "POST" && u === "/cargo", label: "Cargo shipment created" },
  { test: (m, u) => m === "PATCH" && u.startsWith("/cargo/"), label: "Cargo status update" },
  { test: (m, u) => m === "POST" && u === "/expeditions", label: "Expedition created" },
  { test: (m, u) => m === "PATCH" && u.startsWith("/expeditions/"), label: "Expedition update" },
];

function describeItem(item) {
  const match = LABEL_RULES.find((rule) => rule.test(item.method, item.url));
  return match?.label ?? `${item.method} ${item.url}`;
}

const STATUS_TEXT = {
  waiting: "Waiting to sync",
  syncing: "Synchronizing…",
  synced: "Synced",
  failed: "Failed to sync",
};

export default function OfflineQueuePanel() {
  const [state, setState] = useState(() => getBlackoutState());
  const [showBanner, setShowBanner] = useState(false);
  const prevQueueLenRef = useRef(0);

  useEffect(() => subscribeBlackout(setState), []);

  useEffect(() => {
    const hadItems = prevQueueLenRef.current > 0;
    const isEmptyNow = state.queue.length === 0;
    if (hadItems && isEmptyNow && !state.active) {
      setShowBanner(true);
      const timeout = setTimeout(() => setShowBanner(false), 2500);
      return () => clearTimeout(timeout);
    }
    prevQueueLenRef.current = state.queue.length;
    return undefined;
  }, [state.queue.length, state.active]);

  if (state.queue.length === 0 && !showBanner) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[1800] w-full max-w-[320px]">
      {showBanner && (
        <div className="glass-card animate-fade-slide-up mb-3 bg-surface-solid p-4 shadow-glass-hover">
          <p className="text-sm font-bold text-status-ok">CONNECTION RESTORED</p>
          <p className="mt-1 text-xs text-text-secondary">All records consistent.</p>
        </div>
      )}

      {state.queue.length > 0 && (
        <div className="glass-card animate-fade-slide-up bg-surface-solid p-4 shadow-glass-hover">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-text-primary">Offline Action Queue</p>
            <span className="text-xs text-text-secondary">{state.queue.length} changes pending</span>
          </div>

          <div className="space-y-2">
            {state.queue.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs transition-opacity duration-200"
              >
                <span className="truncate text-text-primary">{describeItem(item)}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {item.status === "syncing" && <Loader2 size={12} className="animate-spin text-accent" />}
                  {item.status === "synced" && <CheckCircle2 size={12} className="text-status-ok" />}
                  {item.status === "failed" && <XCircle size={12} className="text-status-critical" />}
                  <span className={item.status === "failed" ? "text-status-critical" : "text-text-secondary"}>
                    {STATUS_TEXT[item.status]}
                  </span>
                  {item.status === "failed" && (
                    <button
                      type="button"
                      onClick={() => retryQueueItem(item.id)}
                      className="focus-ring font-semibold text-accent hover:underline"
                    >
                      Retry
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[11px] leading-snug text-text-secondary">
            Simulated interruption — demonstrates queued sync. Persistent offline storage is a roadmap item.
          </p>
        </div>
      )}
    </div>
  );
}
