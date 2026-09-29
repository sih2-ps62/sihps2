import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { days } from "../../lib/planning";

function at(series, day, key) {
  if (!series?.length) return null;
  // Repeated x values show an arrival's vertical step; use the final balance at that instant.
  let previous = series[0];
  for (const next of series) {
    if (next.day > day) {
      const fraction = (day - previous.day) / (next.day - previous.day);
      return previous[key] + (next[key] - previous[key]) * fraction;
    }
    previous = next;
  }
  return previous[key];
}

export default function ForecastChart({ current, baseline, recovery, horizon }) {
  if (!current || current.status === "unknown") return (
    <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-border p-8 text-center text-sm text-text-secondary">
      {current?.reason || "Configure a consumption range to see the endurance forecast."}
    </div>
  );
  // Include the instant before each step so separate baseline/scenario arrival times remain visible.
  const coordinates = new Set([0, horizon]);
  for (const series of [current.series, baseline?.series, recovery?.series]) {
    series?.forEach((p, i) => {
      coordinates.add(p.day);
      if (i && p.day === series[i - 1].day) coordinates.add(Math.max(0, p.day - 0.0001));
    });
  }
  const points = [...coordinates].sort((a, b) => a - b).map((day) => ({
    day, baseline: at(baseline?.series, day, "low"), scenario: at(current.series, day, "low"),
    range: [at(current.series, day, "low"), at(current.series, day, "high")],
    recovery: at(recovery?.series, day, "balance"),
  }));
  return (
    <div>
      <div className="h-64 w-full min-w-0 sm:h-72" role="img" aria-label={`${current.name} supply forecast. Earliest reserve: ${days(current.reserve_days_min, horizon)}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 15, right: 8, bottom: 5, left: 0 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 5" />
            <XAxis type="number" dataKey="day" domain={[0, horizon]} tickFormatter={(d) => `D${Math.round(d)}`} tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis width={48} tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
              <div className="rounded-xl border border-border bg-surface-solid p-3 text-xs shadow-glass">
                <p className="mb-2 font-semibold">Day {Number(label).toFixed(1)} · {current.unit}</p>
                {payload.filter((p) => p.dataKey !== "range" && p.value != null).map((p) => <p key={p.dataKey} className="py-0.5" style={{ color: p.color }}>{p.name}: {Number(p.value).toFixed(1)}</p>)}
              </div>
            ) : null} />
            <Area type="linear" dataKey="range" fill="var(--color-accent)" fillOpacity={0.10} stroke="none" isAnimationActive={false} />
            <ReferenceLine y={current.reserve} stroke="var(--color-status-warning)" strokeDasharray="5 4" />
            <ReferenceLine y={0} stroke="var(--color-border)" />
            <Line type="linear" name="Baseline" dataKey="baseline" stroke="var(--color-text-secondary)" strokeWidth={1.6} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
            <Line type="linear" name="Scenario" dataKey="scenario" stroke="var(--color-accent)" strokeWidth={2.6} dot={false} isAnimationActive={false} />
            {recovery && <Line type="linear" name="With transfer" dataKey="recovery" stroke="var(--color-status-ok)" strokeWidth={2.6} dot={false} isAnimationActive={false} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-text-secondary">
        <span>┄ Baseline</span><span className="text-accent">━ Scenario + consumption range</span>
        <span className="text-status-warning">┄ Reserve: {current.reserve} {current.unit}</span>
        {recovery && <span className="text-status-ok">━ With selected transfer</span>}
      </div>
      <p className="mt-3 text-xs text-text-secondary">Lines use maximum daily consumption. Shading spans the entered consumption range. Values below zero represent unmet demand.</p>
    </div>
  );
}
