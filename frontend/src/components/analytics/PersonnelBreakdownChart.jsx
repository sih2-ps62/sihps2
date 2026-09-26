import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import Reveal from "../ui/Reveal";

// Recharts renders inline SVG, not CSS classes — these mirror the
// status.ok / border / text-secondary tokens in tailwind.config.js.
const STATUS_COLORS = {
  "In Field": "#15A874",
  "On Leave": "#CFE3EE",
  Base: "#5C7C90",
};

export default function PersonnelBreakdownChart({ breakdown, delay = 0 }) {
  const data = breakdown.map((row) => ({ name: row.status, value: row.count }));

  return (
    <Reveal delay={delay} className="glass-card p-5">
      <div className="mb-2">
        <h2 className="text-lg font-semibold text-text-primary">Personnel Deployment</h2>
        <p className="text-sm text-text-secondary">Current field status breakdown</p>
      </div>
      {data.length === 0 ? (
        <p className="flex h-56 items-center justify-center text-sm text-text-secondary">No personnel yet.</p>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? "#CFE3EE"} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #CFE3EE", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#5C7C90" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Reveal>
  );
}
