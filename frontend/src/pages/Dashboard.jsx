import StatRow from "../components/dashboard/StatRow";
import PolarMap from "../components/map/PolarMap";
import AlertsPanel from "../components/dashboard/AlertsPanel";
import CommsRiskBanner from "../components/dashboard/CommsRiskBanner";
import QuickAccessGrid from "../components/dashboard/QuickAccessGrid";

export default function Dashboard() {
  return (
    <div className="flex flex-col gap-4 px-6 py-6 md:px-8">
      <CommsRiskBanner />
      <StatRow />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.85fr_1fr]">
        <PolarMap height="420px" delay={200} />
        <AlertsPanel />
      </div>
      <QuickAccessGrid />
    </div>
  );
}
