import { RadioTower, Satellite } from "lucide-react";
import Reveal from "../ui/Reveal";
import { useQuery } from "../../hooks/useApi";
import { api } from "../../lib/api";

// Real geomagnetic / radio-blackout conditions from NOAA SWPC (backend/spaceweather.py) — HF radio, the
// fallback comms path at remote polar stations, is disrupted by both, and hits high-latitude stations hardest.
const TONE = {
  0: "border-border/60 bg-surface text-text-secondary",
  1: "border-status-warning/30 bg-status-warning/10 text-status-warning",
  2: "border-status-warning/30 bg-status-warning/10 text-status-warning",
  3: "border-status-critical/30 bg-status-critical/10 text-status-critical",
  4: "border-status-critical/30 bg-status-critical/10 text-status-critical",
  5: "border-status-critical/30 bg-status-critical/10 text-status-critical",
};

export default function CommsRiskBanner({ delay = 0 }) {
  const { data } = useQuery(() => api.get("/comms-risk"), []);
  const reading = data?.data;
  if (!reading) return null;

  const quiet = reading.level === 0;
  const Icon = quiet ? Satellite : RadioTower;
  const detail = [reading.geomagnetic_text, reading.radio_blackout_text]
    .filter((t) => t && t !== "none")
    .join(" · ");

  return (
    <Reveal delay={delay} className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm ${TONE[reading.level]}`}>
      <Icon size={16} strokeWidth={1.75} className="shrink-0" />
      <span className="font-medium">
        {quiet ? "Comms nominal" : `Elevated comms risk — ${detail || reading.label}`}
      </span>
      <span className="ml-auto shrink-0 text-xs opacity-70">live · NOAA SWPC</span>
    </Reveal>
  );
}
