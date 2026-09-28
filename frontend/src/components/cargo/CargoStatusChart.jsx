import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import Reveal from "../ui/Reveal";
import { useChartColors } from "../../hooks/useChartColors";

export default function CargoStatusChart({ stats, delay = 0 }) {
  const colors = useChartColors();
  const STATUS_COLORS = {
    Delivered: colors.ok,
    "In Transit": colors.secondary,
    Delayed: colors.warning,
    Pending: colors.muted,
  };
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
            <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${colors.tooltipBorder}`, fontSize: 12, background: colors.tooltipBg }} />
            <Legend wrapperStyle={{ fontSize: 12, color: colors.tick }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Reveal>
  );
}
