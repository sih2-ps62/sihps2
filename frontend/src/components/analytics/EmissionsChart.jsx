import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Reveal from "../ui/Reveal";
import { useChartColors } from "../../hooks/useChartColors";

export default function EmissionsChart({ expeditions, total, delay = 0 }) {
  const colors = useChartColors();
  return (
    <Reveal delay={delay} className="glass-card p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Estimated Cargo Footprint</h2>
          <p className="text-sm text-text-secondary">Route distance × assigned cargo weight, per expedition</p>
        </div>
        <p className="text-sm font-semibold text-text-primary">{total} kg CO₂ total</p>
      </div>
      {expeditions.length === 0 ? (
        <p className="flex h-48 items-center justify-center text-sm text-text-secondary">No expeditions yet.</p>
      ) : (
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={expeditions} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: colors.tick }} />
              <YAxis tick={{ fontSize: 11, fill: colors.tick }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: `1px solid ${colors.tooltipBorder}`, fontSize: 12, background: colors.tooltipBg }}
                labelStyle={{ color: colors.tooltipLabel, fontWeight: 600 }}
                formatter={(value) => [`${value} kg CO₂`, "Estimated footprint"]}
              />
              <Bar dataKey="estimated_emissions_kg" fill={colors.warning} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Reveal>
  );
}
