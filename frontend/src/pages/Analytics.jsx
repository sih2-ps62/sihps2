import TrendChart from "../components/ui/TrendChart";
import ExpeditionTimelineChart from "../components/analytics/ExpeditionTimelineChart";
import PersonnelBreakdownChart from "../components/analytics/PersonnelBreakdownChart";
import CategoryStockChart from "../components/analytics/CategoryStockChart";
import EmissionsChart from "../components/analytics/EmissionsChart";
import { useQuery } from "../hooks/useApi";
import { api } from "../lib/api";

export default function Analytics() {
  const { data, isLoading } = useQuery(() => api.get("/analytics"), []);

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4 px-6 py-6 md:px-8">
        <p className="text-sm text-text-secondary">Loading analytics…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-6 py-6 md:px-8">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TrendChart
          title="Emergency Reports Over Time"
          subtitle="Incidents reported per day"
          data={data.emergenciesByDay}
          dataKey="count"
          yLabel="Reports"
          delay={0}
        />
        <TrendChart
          title="Response Time Trend"
          subtitle="Hours from report to resolution"
          data={data.responseTimeTrend}
          dataKey="hours"
          yLabel="Hours"
          delay={40}
        />
      </div>

      <ExpeditionTimelineChart expeditions={data.expeditionTimeline} delay={80} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TrendChart
          title="Cargo Shipments Over Time"
          subtitle="Manifests created per day"
          data={data.cargoByDay}
          dataKey="count"
          yLabel="Shipments"
          delay={120}
        />
        <PersonnelBreakdownChart breakdown={data.personnelBreakdown} delay={160} />
      </div>

      <CategoryStockChart categories={data.inventoryByCategory} delay={200} />

      <EmissionsChart
        expeditions={data.emissionsByExpedition}
        total={data.totalEstimatedEmissionsKg}
        delay={240}
      />
    </div>
  );
}
