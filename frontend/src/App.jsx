import { Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import MapPage from "./pages/MapPage";
import Expeditions from "./pages/Expeditions";
import ExpeditionDetail from "./pages/ExpeditionDetail";
import Cargo from "./pages/Cargo";
import CargoDetail from "./pages/CargoDetail";
import Inventory from "./pages/Inventory";
import InventoryDetail from "./pages/InventoryDetail";
import Personnel from "./pages/Personnel";
import PersonnelDetail from "./pages/PersonnelDetail";
import Emergency from "./pages/Emergency";
import Analytics from "./pages/Analytics";
import AuditLog from "./pages/AuditLog";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
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
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/audit-log" element={<AuditLog />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
