import { Compass, Package, Boxes, Users, Wrench, Siren } from "lucide-react";

export const quickAccessModules = [
  { id: "expeditions", target: "/expeditions", label: "Expeditions", description: "Plan routes & assignments", icon: Compass },
  { id: "cargo", target: "/cargo", label: "Cargo", description: "Track shipments & manifests", icon: Package },
  { id: "inventory", target: "/inventory", label: "Inventory", description: "Monitor stock & supplies", icon: Boxes },
  { id: "personnel", target: "/personnel", label: "Personnel", description: "Manage field staff", icon: Users },
  { id: "assets", target: "/inventory", label: "Assets", description: "Maintenance & equipment status", icon: Wrench },
  { id: "emergency", target: "/emergency", label: "Emergency", description: "Incident response & alerts", icon: Siren },
];
