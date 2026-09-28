import { useState } from "react";
import { FileText, Printer, RefreshCw } from "lucide-react";
import Reveal from "../components/ui/Reveal";
import Button from "../components/ui/Button";
import { api } from "../lib/api";
import { useToast } from "../context/ToastContext";
import { formatRelativeTime } from "../lib/format";

// Same section headers the backend prompts Gemini to use (and the local fallback renders verbatim) —
// see backend/ui_api/sitrep.py. Parsing on them turns the plain-text report into titled blocks.
const SECTION_HEADERS = [
  "OPERATIONAL SUMMARY", "STATION READINESS", "WEATHER & COMMS", "CARGO & INVENTORY",
  "PERSONNEL", "EMERGENCIES", "EXPEDITIONS",
];

function parseSections(text) {
  const sections = [];
  let current = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (SECTION_HEADERS.includes(line)) {
      current = { title: line, body: [] };
      sections.push(current);
    } else if (current) {
      current.body.push(line);
    } else {
      sections.push({ title: null, body: [line] });
    }
  }
  return sections;
}

export default function SitrepPage() {
  const { showToast } = useToast();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      setReport(await api.get("/sitrep"));
    } catch (err) {
      showToast(err.message, { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const sections = report ? parseSections(report.text) : [];

  return (
    <div className="flex flex-col gap-4 px-6 py-6 md:px-8">
      <Reveal className="glass-card flex flex-wrap items-center justify-between gap-3 p-5 print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Situation Report</h1>
          <p className="text-sm text-text-secondary">
            One-click shift handover — expeditions, cargo, inventory, personnel, emergencies, weather & comms in
            one document.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {report && (
            <Button variant="ghost" icon={Printer} onClick={() => window.print()}>
              Print / PDF
            </Button>
          )}
          <Button icon={report ? RefreshCw : FileText} onClick={generate} disabled={loading}>
            {loading ? "Generating…" : report ? "Regenerate" : "Generate SITREP"}
          </Button>
        </div>
      </Reveal>

      {report && (
        <Reveal delay={80} className="glass-card p-6">
          <div className="mb-4 flex items-center justify-between text-xs text-text-secondary print:hidden">
            <span>Generated {formatRelativeTime(report.generated_at)}</span>
            <span>
              {report.source === "gemini" ? "Written by Gemini from live data" : "Built-in engine — Gemini unavailable"}
            </span>
          </div>
          <div className="space-y-5">
            {sections.map((section, idx) => (
              <div key={idx}>
                {section.title && (
                  <h2 className="mb-1.5 text-sm font-bold uppercase tracking-wide text-accent">{section.title}</h2>
                )}
                {section.body.map((line, i) => (
                  <p key={i} className="text-sm leading-relaxed text-text-primary">
                    {line}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </Reveal>
      )}

      {!report && !loading && (
        <Reveal delay={80} className="glass-card flex h-48 items-center justify-center text-sm text-text-secondary">
          Click "Generate SITREP" to compile today's report from live data.
        </Reveal>
      )}
    </div>
  );
}
