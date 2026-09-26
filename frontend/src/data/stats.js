import { Compass, Users, PackageX, Wrench, Siren } from "lucide-react";

export const statItems = [
  { id: "expeditions", statKey: "activeExpeditions", label: "Active Expeditions", icon: Compass },
  { id: "personnel", statKey: "personnelInField", label: "Personnel in Field", icon: Users },
  { id: "lowstock", statKey: "lowStockAlerts", label: "Low Stock Alerts", icon: PackageX },
  { id: "maintenance", statKey: "assetsNeedingMaintenance", label: "Assets Needing Maintenance", icon: Wrench },
  { id: "emergencies", statKey: "openEmergencies", label: "Open Emergencies", icon: Siren },
];
