import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Reveal from "../ui/Reveal";

// Recharts renders inline SVG, not CSS classes — these mirror the
// accent / status.warning tokens in tailwind.config.js.
const COLORS = { quantity: "#2AA9E0", threshold: "#D97706" };

export default function StockLevelChart({ items, delay = 0 }) {
  const data = items.map((item) => ({
    name: item.name.length > 14 ? `${item.name.slice(0, 14)}…` : item.name,
    quantity: item.quantity,
    threshold: item.threshold,
  }));

  return (
    <Reveal delay={delay} className="glass-card p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-text-primary">Stock vs. Threshold</h2>
        <p className="text-sm text-text-secondary">Current quantity against the low-stock line</p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#CFE3EE" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#5C7C90" }} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 11, fill: "#5C7C90" }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "1px solid #CFE3EE", fontSize: 12 }}
              labelStyle={{ color: "#14324A", fontWeight: 600 }}
            />
            <Bar dataKey="quantity" name="Quantity" fill={COLORS.quantity} radius={[4, 4, 0, 0]} />
            <Bar dataKey="threshold" name="Threshold" fill={COLORS.threshold} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Reveal>
  );
}
