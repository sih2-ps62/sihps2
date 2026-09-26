import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireRole } from "../lib/auth.js";
import { parseListQuery, paginate } from "../lib/query.js";
import { recordAudit } from "../lib/audit.js";

const router = Router();
const SORTABLE = ["name", "role", "status", "created_at"];

router.get("/", (req, res) => {
  const { page, pageSize, sort, order, offset } = parseListQuery(req, {
    sortableColumns: SORTABLE,
    defaultSort: "name",
  });

  const where = [];
  const params = {};
  if (req.query.status) {
    where.push("p.status = @status");
    params.status = req.query.status;
  }
  if (req.query.q) {
    where.push("(p.name LIKE @q OR p.role LIKE @q)");
    params.q = `%${req.query.q}%`;
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const total = db.prepare(`SELECT COUNT(*) AS n FROM personnel p ${whereSql}`).get(params).n;
  const data = db
    .prepare(
      `SELECT p.*, s.name AS station_name, s.region AS station_region
       FROM personnel p LEFT JOIN stations s ON s.id = p.station_id
       ${whereSql} ORDER BY p.${sort} ${order} LIMIT @pageSize OFFSET @offset`
    )
    .all({ ...params, pageSize, offset });

  res.json(paginate(data, total, page, pageSize));
});

router.get("/:id", (req, res) => {
  const row = db
    .prepare(
      `SELECT p.*, s.name AS station_name, s.region AS station_region
       FROM personnel p LEFT JOIN stations s ON s.id = p.station_id WHERE p.id = ?`
    )
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: "Personnel record not found." });
  res.json({ data: row });
});

router.post("/", requireAuth, (req, res) => {
  const { name, role, station_id, status } = req.body ?? {};
  if (!name || !role || !status) return res.status(400).json({ error: "name, role and status are required." });
  const result = db
    .prepare(`INSERT INTO personnel (name, role, station_id, status) VALUES (@name, @role, @station_id, @status)`)
    .run({ name, role, station_id: station_id || null, status });
  const created = db.prepare("SELECT * FROM personnel WHERE id = ?").get(result.lastInsertRowid);
  recordAudit({
    user: req.user,
    action: "create",
    resourceType: "personnel",
    resourceId: created.id,
    summary: `Added personnel "${created.name}" (${created.role})`,
  });
  res.status(201).json({ data: created });
});

router.patch("/:id", requireAuth, (req, res) => {
  const existing = db.prepare("SELECT * FROM personnel WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Personnel record not found." });
  const next = { ...existing, ...req.body, id: req.params.id };
  db.prepare(
    `UPDATE personnel SET name=@name, role=@role, station_id=@station_id, status=@status,
     updated_at=datetime('now') WHERE id=@id`
  ).run(next);
  const updated = db.prepare("SELECT * FROM personnel WHERE id = ?").get(req.params.id);
  recordAudit({
    user: req.user,
    action: "update",
    resourceType: "personnel",
    resourceId: updated.id,
    summary: `Updated personnel "${updated.name}" (${updated.status})`,
  });
  res.json({ data: updated });
});

router.post("/:id/checkin", requireAuth, (req, res) => {
  const existing = db.prepare("SELECT * FROM personnel WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Personnel record not found." });
  db.prepare("UPDATE personnel SET last_checkin = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(
    req.params.id
  );
  recordAudit({
    user: req.user,
    action: "update",
    resourceType: "personnel",
    resourceId: existing.id,
    summary: `Check-in recorded for "${existing.name}"`,
  });
  res.json({ data: db.prepare("SELECT * FROM personnel WHERE id = ?").get(req.params.id) });
});

router.delete("/:id", requireAuth, requireRole("admin"), (req, res) => {
  const existing = db.prepare("SELECT * FROM personnel WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Personnel record not found." });
  db.prepare("DELETE FROM personnel WHERE id = ?").run(req.params.id);
  recordAudit({
    user: req.user,
    action: "delete",
    resourceType: "personnel",
    resourceId: req.params.id,
    summary: `Removed personnel "${existing.name}"`,
  });
  res.status(204).end();
});

export default router;
