import db from "../db.js";

export function recordAudit({ user, action, resourceType, resourceId, summary }) {
  db.prepare(
    `INSERT INTO audit_log (user_id, user_name, action, resource_type, resource_id, summary)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(user?.sub ?? null, user?.name ?? "Unknown", action, resourceType, String(resourceId), summary);
}
