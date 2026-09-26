import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireRole } from "../lib/auth.js";
import { parseListQuery, paginate } from "../lib/query.js";
import { recordAudit } from "../lib/audit.js";

const router = Router();
const SORTABLE = ["manifest_id", "description", "status", "weight_kg", "created_at"];

router.get("/", (req, res) => {
  const { page, pageSize, sort, order, offset } = parseListQuery(req, {
    sortableColumns: SORTABLE,
    defaultSort: "created_at",
  });

  const where = [];
  const params = {};
  if (req.query.status) {
    where.push("status = @status");
    params.status = req.query.status;
  }
  if (req.query.q) {
    where.push("(description LIKE @q OR manifest_id LIKE @q OR origin LIKE @q OR destination LIKE @q)");
    params.q = `%${req.query.q}%`;
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const total = db.prepare(`SELECT COUNT(*) AS n FROM cargo ${whereSql}`).get(params).n;
  const data = db
    .prepare(`SELECT * FROM cargo ${whereSql} ORDER BY ${sort} ${order} LIMIT @pageSize OFFSET @offset`)
    .all({ ...params, pageSize, offset });

  res.json(paginate(data, total, page, pageSize));
});

router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM cargo WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Cargo record not found." });
  res.json({ data: row });
});

router.post("/", requireAuth, (req, res) => {
  const { manifest_id, description, status, origin, destination, weight_kg } = req.body ?? {};
  if (!manifest_id || !description || !status || !origin || !destination) {
    return res.status(400).json({ error: "manifest_id, description, status, origin and destination are required." });
  }
  const result = db
    .prepare(
      `INSERT INTO cargo (manifest_id, description, status, origin, destination, weight_kg)
       VALUES (@manifest_id, @description, @status, @origin, @destination, @weight_kg)`
    )
    .run({ manifest_id, description, status, origin, destination, weight_kg: weight_kg || 0 });
  const created = db.prepare("SELECT * FROM cargo WHERE id = ?").get(result.lastInsertRowid);
  recordAudit({
    user: req.user,
    action: "create",
    resourceType: "cargo",
    resourceId: created.id,
    summary: `Created cargo manifest "${created.manifest_id}"`,
  });
  res.status(201).json({ data: created });
});

router.patch("/:id", requireAuth, (req, res) => {
  const existing = db.prepare("SELECT * FROM cargo WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Cargo record not found." });
  const next = { ...existing, ...req.body, id: req.params.id };
  db.prepare(
    `UPDATE cargo SET manifest_id=@manifest_id, description=@description, status=@status, origin=@origin,
     destination=@destination, weight_kg=@weight_kg, updated_at=datetime('now') WHERE id=@id`
  ).run(next);
  const updated = db.prepare("SELECT * FROM cargo WHERE id = ?").get(req.params.id);
  recordAudit({
    user: req.user,
    action: "update",
    resourceType: "cargo",
    resourceId: updated.id,
    summary: `Updated cargo manifest "${updated.manifest_id}" (${updated.status})`,
  });
  res.json({ data: updated });
});

router.delete("/:id", requireAuth, requireRole("admin"), (req, res) => {
  const existing = db.prepare("SELECT * FROM cargo WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Cargo record not found." });
  db.prepare("DELETE FROM cargo WHERE id = ?").run(req.params.id);
  recordAudit({
    user: req.user,
    action: "delete",
    resourceType: "cargo",
    resourceId: req.params.id,
    summary: `Deleted cargo manifest "${existing.manifest_id}"`,
  });
  res.status(204).end();
});

export default router;
