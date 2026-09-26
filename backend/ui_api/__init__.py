# OWNER: integration (Day 2-3)
# The frontend-facing API, mounted at /api. It serves the contract the React app was built against (JWT login,
# paginated `{data, total, page, pageSize, totalPages}` lists, audit log, analytics, assistant) on top of the same
# database and rule engine as the plan's endpoints - see docs/API_CONTRACT.md, section "Frontend API".
from fastapi import APIRouter

from ui_api import analytics, assistant, audit_log, auth, cargo, emergencies, expeditions, inventory, personnel
from ui_api import stations, stats

router = APIRouter(prefix="/api")


@router.get("/health", tags=["ui: health"])
def api_health():
    return {"ok": True}


for module in (auth, stations, expeditions, cargo, inventory, personnel, emergencies, stats, analytics, audit_log,
               assistant):
    router.include_router(module.router)
