import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireRole } from "../lib/auth.js";
import { parseListQuery, paginate } from "../lib/query.js";
import { recordAudit } from "../lib/audit.js";

const router = Router();
const SORTABLE = ["name", "status", "region", "start_date", "created_at"];

router.get("/", (req, res) => {
  const { page, pageSize, sort, order, offset } = parseListQuery(req, {
    sortableColumns: SORTABLE,
    defaultSort: "start_date",
  });

  const where = [];
  const params = {};
  if (req.query.status) {
    where.push("status = @status");
    params.status = req.query.status;
  }
  if (req.query.region) {
    where.push("region = @region");
    params.region = req.query.region;
  }
  if (req.query.q) {
    where.push("(name LIKE @q OR team_lead LIKE @q)");
    params.q = `%${req.query.q}%`;
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const total = db.prepare(`SELECT COUNT(*) AS n FROM expeditions ${whereSql}`).get(params).n;
  const rows = db
    .prepare(`SELECT * FROM expeditions ${whereSql} ORDER BY ${sort} ${order} LIMIT @pageSize OFFSET @offset`)
    .all({ ...params, pageSize, offset });

  const data = rows.map((row) => ({ ...row, waypoints: JSON.parse(row.waypoints || "[]") }));
  res.json(paginate(data, total, page, pageSize));
});

router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM expeditions WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Expedition not found." });
  res.json({ data: { ...row, waypoints: JSON.parse(row.waypoints || "[]") } });
});

router.post("/", requireAuth, (req, res) => {
  const { name, status, region, start_date, end_date, team_lead, waypoints } = req.body ?? {};
  if (!name || !status || !region || !start_date || !team_lead) {
    return res.status(400).json({ error: "name, status, region, start_date and team_lead are required." });
  }

  const result = db
    .prepare(
      `INSERT INTO expeditions (name, status, region, start_date, end_date, team_lead, waypoints)
       VALUES (@name, @status, @region, @start_date, @end_date, @team_lead, @waypoints)`
    )
    .run({
      name,
      status,
      region,
      start_date,
      end_date: end_date || null,
      team_lead,
      waypoints: JSON.stringify(waypoints || []),
    });

  const created = db.prepare("SELECT * FROM expeditions WHERE id = ?").get(result.lastInsertRowid);
  recordAudit({
    user: req.user,
    action: "create",
    resourceType: "expedition",
    resourceId: created.id,
    summary: `Created expedition "${created.name}"`,
  });
  res.status(201).json({ data: { ...created, waypoints: JSON.parse(created.waypoints || "[]") } });
});

router.patch("/:id", requireAuth, (req, res) => {
  const existing = db.prepare("SELECT * FROM expeditions WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Expedition not found." });

  const next = { ...existing, ...req.body };
  db.prepare(
    `UPDATE expeditions SET name=@name, status=@status, region=@region, start_date=@start_date,
     end_date=@end_date, team_lead=@team_lead, waypoints=@waypoints, updated_at=datetime('now')
     WHERE id=@id`
  ).run({
    ...next,
    waypoints: JSON.stringify(req.body?.waypoints ?? JSON.parse(existing.waypoints || "[]")),
    id: req.params.id,
  });

  const updated = db.prepare("SELECT * FROM expeditions WHERE id = ?").get(req.params.id);
  recordAudit({
    user: req.user,
    action: "update",
    resourceType: "expedition",
    resourceId: updated.id,
    summary: `Updated expedition "${updated.name}"`,
  });
  res.json({ data: { ...updated, waypoints: JSON.parse(updated.waypoints || "[]") } });
});

router.delete("/:id", requireAuth, requireRole("admin"), (req, res) => {
  const existing = db.prepare("SELECT * FROM expeditions WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Expedition not found." });
  db.prepare("DELETE FROM expeditions WHERE id = ?").run(req.params.id);
  recordAudit({
    user: req.user,
    action: "delete",
    resourceType: "expedition",
    resourceId: req.params.id,
    summary: `Deleted expedition "${existing.name}"`,
  });
  res.status(204).end();
});

export default router;
