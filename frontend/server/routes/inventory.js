import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireRole } from "../lib/auth.js";
import { parseListQuery, paginate } from "../lib/query.js";
import { recordAudit } from "../lib/audit.js";

const router = Router();
const SORTABLE = ["name", "category", "quantity", "threshold", "created_at"];

router.get("/", (req, res) => {
  const { page, pageSize, sort, order, offset } = parseListQuery(req, {
    sortableColumns: SORTABLE,
    defaultSort: "name",
  });

  const where = [];
  const params = {};
  if (req.query.category) {
    where.push("i.category = @category");
    params.category = req.query.category;
  }
  if (req.query.lowStock === "true") {
    where.push("i.quantity <= i.threshold");
  }
  if (req.query.needsMaintenance === "true") {
    where.push("i.needs_maintenance = 1");
  }
  if (req.query.q) {
    where.push("(i.name LIKE @q OR i.category LIKE @q)");
    params.q = `%${req.query.q}%`;
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const total = db.prepare(`SELECT COUNT(*) AS n FROM inventory i ${whereSql}`).get(params).n;
  const data = db
    .prepare(
      `SELECT i.*, s.name AS station_name, s.region AS station_region
       FROM inventory i LEFT JOIN stations s ON s.id = i.station_id
       ${whereSql} ORDER BY i.${sort} ${order} LIMIT @pageSize OFFSET @offset`
    )
    .all({ ...params, pageSize, offset });

  res.json(paginate(data, total, page, pageSize));
});

router.get("/:id", (req, res) => {
  const row = db
    .prepare(
      `SELECT i.*, s.name AS station_name, s.region AS station_region
       FROM inventory i LEFT JOIN stations s ON s.id = i.station_id WHERE i.id = ?`
    )
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: "Inventory item not found." });
  res.json({ data: row });
});

router.post("/", requireAuth, (req, res) => {
  const { name, category, station_id, quantity, threshold, unit, needs_maintenance } = req.body ?? {};
  if (!name || !category) return res.status(400).json({ error: "name and category are required." });
  const result = db
    .prepare(
      `INSERT INTO inventory (name, category, station_id, quantity, threshold, unit, needs_maintenance)
       VALUES (@name, @category, @station_id, @quantity, @threshold, @unit, @needs_maintenance)`
    )
    .run({
      name,
      category,
      station_id: station_id || null,
      quantity: quantity || 0,
      threshold: threshold || 0,
      unit: unit || "units",
      needs_maintenance: needs_maintenance ? 1 : 0,
    });
  const created = db.prepare("SELECT * FROM inventory WHERE id = ?").get(result.lastInsertRowid);
  recordAudit({
    user: req.user,
    action: "create",
    resourceType: "inventory",
    resourceId: created.id,
    summary: `Added inventory item "${created.name}"`,
  });
  res.status(201).json({ data: created });
});

router.patch("/:id", requireAuth, (req, res) => {
  const existing = db.prepare("SELECT * FROM inventory WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Inventory item not found." });
  const next = { ...existing, ...req.body, id: req.params.id };
  next.needs_maintenance = next.needs_maintenance ? 1 : 0;
  db.prepare(
    `UPDATE inventory SET name=@name, category=@category, station_id=@station_id, quantity=@quantity,
     threshold=@threshold, unit=@unit, needs_maintenance=@needs_maintenance, updated_at=datetime('now') WHERE id=@id`
  ).run(next);
  const updated = db.prepare("SELECT * FROM inventory WHERE id = ?").get(req.params.id);
  recordAudit({
    user: req.user,
    action: "update",
    resourceType: "inventory",
    resourceId: updated.id,
    summary: `Updated inventory item "${updated.name}" (${updated.quantity}/${updated.threshold} ${updated.unit})`,
  });
  res.json({ data: updated });
});

router.delete("/:id", requireAuth, requireRole("admin"), (req, res) => {
  const existing = db.prepare("SELECT * FROM inventory WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Inventory item not found." });
  db.prepare("DELETE FROM inventory WHERE id = ?").run(req.params.id);
  recordAudit({
    user: req.user,
    action: "delete",
    resourceType: "inventory",
    resourceId: req.params.id,
    summary: `Deleted inventory item "${existing.name}"`,
  });
  res.status(204).end();
});

export default router;
