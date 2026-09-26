import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import Reveal from "../ui/Reveal";

// Recharts renders inline SVG, not CSS classes — these mirror the
// status.ok / status.warning / border / text-secondary tokens in tailwind.config.js.
const STATUS_COLORS = {
  Delivered: "#15A874",
  "In Transit": "#5C7C90",
  Delayed: "#D97706",
  Pending: "#CFE3EE",
};

export default function CargoStatusChart({ stats, delay = 0 }) {
  const data = [
    { name: "Delivered", value: stats.delivered },
    { name: "In Transit", value: stats.inTransit },
    { name: "Delayed", value: stats.delayed },
    { name: "Pending", value: Math.max(stats.totalShipments - stats.delivered - stats.inTransit - stats.delayed, 0) },
  ].filter((d) => d.value > 0);

  return (
    <Reveal delay={delay} className="glass-card p-5">
      <div className="mb-2">
        <h2 className="text-lg font-semibold text-text-primary">Shipment Status</h2>
        <p className="text-sm text-text-secondary">Distribution across the current manifest</p>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #CFE3EE", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#5C7C90" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Reveal>
  );
}
