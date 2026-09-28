# OWNER: (feature) space weather / comms risk
# GET /api/comms-risk - real geomagnetic / radio-blackout conditions (NOAA SWPC), a hemisphere-wide reading
# that feeds the comms-risk banner and the Mission Readiness score.
from fastapi import APIRouter, Depends

from spaceweather import current_comms_risk
from ui_api.security import current_user

router = APIRouter(prefix="/comms-risk", tags=["ui: comms risk"], dependencies=[Depends(current_user)])


@router.get("")
def get_comms_risk():
    return {"data": current_comms_risk()}
