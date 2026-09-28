import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Reveal from "../ui/Reveal";
import { useChartColors } from "../../hooks/useChartColors";

export default function CategoryStockChart({ categories, delay = 0 }) {
  const colors = useChartColors();
  return (
    <Reveal delay={delay} className="glass-card p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-text-primary">Stock by Category</h2>
        <p className="text-sm text-text-secondary">Total quantity held per category</p>
      </div>
      {categories.length === 0 ? (
        <p className="flex h-48 items-center justify-center text-sm text-text-secondary">No inventory yet.</p>
      ) : (
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categories} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
              <XAxis dataKey="category" tick={{ fontSize: 11, fill: colors.tick }} />
              <YAxis tick={{ fontSize: 11, fill: colors.tick }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: `1px solid ${colors.tooltipBorder}`, fontSize: 12, background: colors.tooltipBg }}
                labelStyle={{ color: colors.tooltipLabel, fontWeight: 600 }}
              />
              <Bar dataKey="quantity" fill={colors.accent} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Reveal>
  );
}
