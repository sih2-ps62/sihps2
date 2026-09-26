import { Router } from "express";
import db from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  const dashboard = {
    activeExpeditions: db.prepare("SELECT COUNT(*) AS n FROM expeditions WHERE status = 'Active'").get().n,
    personnelInField: db.prepare("SELECT COUNT(*) AS n FROM personnel WHERE status = 'In Field'").get().n,
    lowStockAlerts: db.prepare("SELECT COUNT(*) AS n FROM inventory WHERE quantity <= threshold").get().n,
    assetsNeedingMaintenance: db.prepare("SELECT COUNT(*) AS n FROM inventory WHERE needs_maintenance = 1").get().n,
    openEmergencies: db.prepare("SELECT COUNT(*) AS n FROM emergencies WHERE status = 'Open'").get().n,
  };

  const cargo = {
    totalShipments: db.prepare("SELECT COUNT(*) AS n FROM cargo").get().n,
    inTransit: db.prepare("SELECT COUNT(*) AS n FROM cargo WHERE status = 'In Transit'").get().n,
    delivered: db.prepare("SELECT COUNT(*) AS n FROM cargo WHERE status = 'Delivered'").get().n,
    delayed: db.prepare("SELECT COUNT(*) AS n FROM cargo WHERE status = 'Delayed'").get().n,
  };

  const inventory = {
    totalSkus: db.prepare("SELECT COUNT(*) AS n FROM inventory").get().n,
    lowStock: db.prepare("SELECT COUNT(*) AS n FROM inventory WHERE quantity <= threshold AND quantity > 0").get().n,
    outOfStock: db.prepare("SELECT COUNT(*) AS n FROM inventory WHERE quantity = 0").get().n,
    categories: db.prepare("SELECT COUNT(DISTINCT category) AS n FROM inventory").get().n,
  };

  const personnel = {
    totalStaff: db.prepare("SELECT COUNT(*) AS n FROM personnel").get().n,
    inField: db.prepare("SELECT COUNT(*) AS n FROM personnel WHERE status = 'In Field'").get().n,
    onLeave: db.prepare("SELECT COUNT(*) AS n FROM personnel WHERE status = 'On Leave'").get().n,
    stations: db.prepare("SELECT COUNT(*) AS n FROM stations").get().n,
  };

  const avgResponse = db
    .prepare(
      `SELECT AVG((julianday(resolved_at) - julianday(reported_at)) * 24) AS hours
       FROM emergencies WHERE resolved_at IS NOT NULL`
    )
    .get().hours;

  const emergency = {
    openEmergencies: db.prepare("SELECT COUNT(*) AS n FROM emergencies WHERE status = 'Open'").get().n,
    avgResponseTimeHours: avgResponse == null ? null : Math.round(avgResponse * 10) / 10,
    resolvedLast30d: db
      .prepare("SELECT COUNT(*) AS n FROM emergencies WHERE status = 'Resolved' AND resolved_at >= datetime('now', '-30 days')")
      .get().n,
  };

  res.json({ dashboard, cargo, inventory, personnel, emergency });
});

export default router;
