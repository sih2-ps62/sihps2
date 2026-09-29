import { Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
const MapPage = lazy(() => import("./pages/MapPage"));
const Expeditions = lazy(() => import("./pages/Expeditions"));
const ExpeditionDetail = lazy(() => import("./pages/ExpeditionDetail"));
const Cargo = lazy(() => import("./pages/Cargo"));
const CargoDetail = lazy(() => import("./pages/CargoDetail"));
const Inventory = lazy(() => import("./pages/Inventory"));
const InventoryDetail = lazy(() => import("./pages/InventoryDetail"));
const Personnel = lazy(() => import("./pages/Personnel"));
const PersonnelDetail = lazy(() => import("./pages/PersonnelDetail"));
const Emergency = lazy(() => import("./pages/Emergency"));
const EmergencyDetail = lazy(() => import("./pages/EmergencyDetail"));
const Analytics = lazy(() => import("./pages/Analytics"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const SitrepPage = lazy(() => import("./pages/SitrepPage"));
const Settings = lazy(() => import("./pages/Settings"));
const MissionPlanner = lazy(() => import("./pages/MissionPlanner"));
import NotFound from "./pages/NotFound";
import PolarAtmosphere from "./components/ui/PolarAtmosphere";
import ClickParticles from "./components/ui/ClickParticles";
import ThemeDiscovery from "./components/ui/ThemeDiscovery";

export default function App() {
  return (
    <>
    <PolarAtmosphere />
    <ClickParticles />
    <ThemeDiscovery />
    <Suspense fallback={<p role="status" className="p-8 text-sm text-text-secondary">Loading operations screen…</p>}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/expeditions" element={<Expeditions />} />
        <Route path="/expeditions/:id" element={<ExpeditionDetail />} />
        <Route path="/cargo" element={<Cargo />} />
        <Route path="/cargo/:id" element={<CargoDetail />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/inventory/:id" element={<InventoryDetail />} />
        <Route path="/personnel" element={<Personnel />} />
        <Route path="/personnel/:id" element={<PersonnelDetail />} />
        <Route path="/emergency" element={<Emergency />} />
        <Route path="/emergency/:id" element={<EmergencyDetail />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/audit-log" element={<AuditLog />} />
        <Route path="/sitrep" element={<SitrepPage />} />
        <Route path="/planning" element={<MissionPlanner />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
    </Suspense>
    </>
  );
}
