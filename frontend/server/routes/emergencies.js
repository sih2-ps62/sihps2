import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireRole } from "../lib/auth.js";
import { parseListQuery, paginate } from "../lib/query.js";
import { recordAudit } from "../lib/audit.js";

const router = Router();
const SORTABLE = ["title", "severity", "status", "reported_at"];

router.get("/", (req, res) => {
  const { page, pageSize, sort, order, offset } = parseListQuery(req, {
    sortableColumns: SORTABLE,
    defaultSort: "reported_at",
  });

  const where = [];
  const params = {};
  if (req.query.status) {
    where.push("e.status = @status");
    params.status = req.query.status;
  }
  if (req.query.q) {
    where.push("e.title LIKE @q");
    params.q = `%${req.query.q}%`;
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const total = db.prepare(`SELECT COUNT(*) AS n FROM emergencies e ${whereSql}`).get(params).n;
  const data = db
    .prepare(
      `SELECT e.*, s.name AS station_name FROM emergencies e LEFT JOIN stations s ON s.id = e.station_id
       ${whereSql} ORDER BY e.${sort} ${order} LIMIT @pageSize OFFSET @offset`
    )
    .all({ ...params, pageSize, offset });

  res.json(paginate(data, total, page, pageSize));
});

router.post("/", requireAuth, (req, res) => {
  const { title, severity, station_id } = req.body ?? {};
  if (!title || !severity) return res.status(400).json({ error: "title and severity are required." });
  const result = db
    .prepare(
      `INSERT INTO emergencies (title, severity, status, station_id, reported_at) VALUES (@title, @severity, 'Open', @station_id, datetime('now'))`
    )
    .run({ title, severity, station_id: station_id || null });
  const created = db.prepare("SELECT * FROM emergencies WHERE id = ?").get(result.lastInsertRowid);
  recordAudit({
    user: req.user,
    action: "create",
    resourceType: "emergency",
    resourceId: created.id,
    summary: `Reported emergency "${created.title}" (${created.severity})`,
  });
  res.status(201).json({ data: created });
});

router.patch("/:id", requireAuth, (req, res) => {
  const existing = db.prepare("SELECT * FROM emergencies WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Emergency not found." });

  const resolving = req.body?.status === "Resolved" && existing.status !== "Resolved";
  const next = {
    ...existing,
    ...req.body,
    id: req.params.id,
    resolved_at: resolving ? new Date().toISOString() : existing.resolved_at,
  };
  db.prepare(
    `UPDATE emergencies SET title=@title, severity=@severity, status=@status, station_id=@station_id,
     resolved_at=@resolved_at WHERE id=@id`
  ).run(next);
  const updated = db.prepare("SELECT * FROM emergencies WHERE id = ?").get(req.params.id);
  recordAudit({
    user: req.user,
    action: "update",
    resourceType: "emergency",
    resourceId: updated.id,
    summary: resolving ? `Resolved emergency "${updated.title}"` : `Updated emergency "${updated.title}"`,
  });
  res.json({ data: updated });
});

router.delete("/:id", requireAuth, requireRole("admin"), (req, res) => {
  const existing = db.prepare("SELECT * FROM emergencies WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Emergency not found." });
  db.prepare("DELETE FROM emergencies WHERE id = ?").run(req.params.id);
  recordAudit({
    user: req.user,
    action: "delete",
    resourceType: "emergency",
    resourceId: req.params.id,
    summary: `Deleted emergency "${existing.title}"`,
  });
  res.status(204).end();
});

export default router;
