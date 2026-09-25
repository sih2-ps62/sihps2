# OWNER: Jalak
# Runs on every PATCH /inventory/{id}/adjust
# if inventory_item.quantity < inventory_item.reorder_threshold:
#     inventory_item.status = "low"
# else:
#     inventory_item.status = "ok"
