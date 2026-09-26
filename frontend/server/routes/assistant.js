import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../lib/auth.js";
import { askGemini } from "../lib/gemini.js";

const router = Router();

function buildContext() {
  const stats = {
    activeExpeditions: db.prepare("SELECT COUNT(*) AS n FROM expeditions WHERE status = 'Active'").get().n,
    openEmergencies: db.prepare("SELECT COUNT(*) AS n FROM emergencies WHERE status = 'Open'").get().n,
    lowStockAlerts: db.prepare("SELECT COUNT(*) AS n FROM inventory WHERE quantity <= threshold").get().n,
    personnelInField: db.prepare("SELECT COUNT(*) AS n FROM personnel WHERE status = 'In Field'").get().n,
  };

  const lowStock = db
    .prepare(
      `SELECT i.name, i.category, i.quantity, i.threshold, i.unit, s.name AS station_name
       FROM inventory i LEFT JOIN stations s ON s.id = i.station_id
       WHERE i.quantity <= i.threshold`
    )
    .all();

  const openEmergencies = db
    .prepare(
      `SELECT e.title, e.severity, e.reported_at, s.name AS station_name
       FROM emergencies e LEFT JOIN stations s ON s.id = e.station_id WHERE e.status = 'Open'`
    )
    .all();

  const overduePersonnel = db
    .prepare(
      `SELECT p.name, p.role, p.last_checkin, s.name AS station_name
       FROM personnel p LEFT JOIN stations s ON s.id = p.station_id
       WHERE p.status = 'In Field' AND (p.last_checkin IS NULL OR
         (julianday('now') - julianday(p.last_checkin)) * 24 > 24)`
    )
    .all();

  const expeditions = db.prepare("SELECT name, status, region, start_date, end_date, team_lead FROM expeditions").all();
  const cargo = db.prepare("SELECT manifest_id, description, status, origin, destination FROM cargo").all();

  return { stats, lowStock, openEmergencies, overduePersonnel, expeditions, cargo };
}

const SYSTEM_INSTRUCTION_PREFIX = `You are the PolarOps Assistant, embedded in a polar research logistics dashboard used by duty officers at Antarctic and Arctic stations.

Answer questions using ONLY the operational data provided below — do not invent stations, personnel, incidents, or numbers that aren't in it. If the data doesn't contain what's being asked, say so plainly rather than guessing. Keep answers short and operational — a duty officer reading this on a live shift, not a report. Use plain text, no markdown headers.

Current PolarOps data (JSON):
`;

router.post("/chat", requireAuth, async (req, res) => {
  const { message } = req.body ?? {};
  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required." });
  }

  try {
    const context = buildContext();
    const systemInstruction = SYSTEM_INSTRUCTION_PREFIX + JSON.stringify(context);
    const reply = await askGemini({ systemInstruction, message: message.trim() });
    res.json({ reply });
  } catch (err) {
    res.status(502).json({ error: err.message || "The assistant is unavailable right now." });
  }
});

export default router;
