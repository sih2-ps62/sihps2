import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/", requireAuth, (req, res) => {
  const emergenciesByDay = db
    .prepare(
      `SELECT date(reported_at) AS date, COUNT(*) AS count
       FROM emergencies GROUP BY date(reported_at) ORDER BY date ASC`
    )
    .all();

  const responseTimeTrend = db
    .prepare(
      `SELECT date(resolved_at) AS date, ROUND((julianday(resolved_at) - julianday(reported_at)) * 24, 1) AS hours
       FROM emergencies WHERE resolved_at IS NOT NULL ORDER BY resolved_at ASC`
    )
    .all();

  const cargoByDay = db
    .prepare(`SELECT date(created_at) AS date, COUNT(*) AS count FROM cargo GROUP BY date(created_at) ORDER BY date ASC`)
    .all();

  const expeditionTimeline = db
    .prepare(`SELECT id, name, status, region, start_date, end_date FROM expeditions ORDER BY start_date ASC`)
    .all();

  const personnelBreakdown = db
    .prepare(`SELECT status, COUNT(*) AS count FROM personnel GROUP BY status`)
    .all();

  const inventoryByCategory = db
    .prepare(`SELECT category, SUM(quantity) AS quantity, COUNT(*) AS items FROM inventory GROUP BY category ORDER BY category ASC`)
    .all();

  res.json({
    emergenciesByDay,
    responseTimeTrend,
    cargoByDay,
    expeditionTimeline,
    personnelBreakdown,
    inventoryByCategory,
  });
});

export default router;
