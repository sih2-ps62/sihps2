# OWNER: Jalak
# Runs on every POST /inventory and PATCH /inventory/{id}/adjust
#   quantity < reorder_threshold  ->  status "low", else "ok"


def compute_status(quantity: int, reorder_threshold: int) -> str:
    return "low" if quantity < reorder_threshold else "ok"


def apply_low_stock(item):
    item.status = compute_status(item.quantity, item.reorder_threshold)
    return item
