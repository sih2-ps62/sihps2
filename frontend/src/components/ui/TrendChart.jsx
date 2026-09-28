import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Reveal from "./Reveal";
import { useChartColors } from "../../hooks/useChartColors";

export default function TrendChart({ title, subtitle, data, dataKey, yLabel, delay = 0 }) {
  const colors = useChartColors();
  return (
    <Reveal delay={delay} className="glass-card p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        <p className="text-sm text-text-secondary">{subtitle}</p>
      </div>
      {data.length === 0 ? (
        <p className="flex h-48 items-center justify-center text-sm text-text-secondary">No data yet.</p>
      ) : (
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: colors.tick }} />
              <YAxis tick={{ fontSize: 11, fill: colors.tick }} allowDecimals={false} label={{ value: yLabel, angle: -90, position: "insideLeft", fontSize: 11, fill: colors.tick }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: `1px solid ${colors.tooltipBorder}`, fontSize: 12, background: colors.tooltipBg }}
                labelStyle={{ color: colors.tooltipLabel, fontWeight: 600 }}
              />
              <Line type="monotone" dataKey={dataKey} stroke={colors.accent} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Reveal>
  );
}
