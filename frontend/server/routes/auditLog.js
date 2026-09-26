import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../lib/auth.js";
import { parseListQuery, paginate } from "../lib/query.js";

const router = Router();
const SORTABLE = ["created_at", "user_name", "action", "resource_type"];

router.get("/", requireAuth, (req, res) => {
  const { page, pageSize, sort, order, offset } = parseListQuery(req, {
    sortableColumns: SORTABLE,
    defaultSort: "created_at",
  });

  const where = [];
  const params = {};
  if (req.query.resourceType) {
    where.push("resource_type = @resourceType");
    params.resourceType = req.query.resourceType;
  }
  if (req.query.action) {
    where.push("action = @action");
    params.action = req.query.action;
  }
  if (req.query.q) {
    where.push("(summary LIKE @q OR user_name LIKE @q)");
    params.q = `%${req.query.q}%`;
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const total = db.prepare(`SELECT COUNT(*) AS n FROM audit_log ${whereSql}`).get(params).n;
  const data = db
    .prepare(`SELECT * FROM audit_log ${whereSql} ORDER BY ${sort} ${order} LIMIT @pageSize OFFSET @offset`)
    .all({ ...params, pageSize, offset });

  res.json(paginate(data, total, page, pageSize));
});

export default router;
