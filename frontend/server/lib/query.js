const ALLOWED_ORDER = new Set(["asc", "desc"]);

export function parseListQuery(req, { sortableColumns, defaultSort }) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
  const sortRaw = req.query.sort;
  const orderRaw = String(req.query.order || "asc").toLowerCase();

  const sort = sortableColumns.includes(sortRaw) ? sortRaw : defaultSort;
  const order = ALLOWED_ORDER.has(orderRaw) ? orderRaw : "asc";

  return { page, pageSize, sort, order, offset: (page - 1) * pageSize };
}

export function paginate(rows, total, page, pageSize) {
  return { data: rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
