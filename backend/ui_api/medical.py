"""Clinical data is never included in regular personnel or incident serializers."""
import hashlib
import secrets
from datetime import timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from db import get_db, get_or_404, utcnow
from models.emergency import EmergencyIncident
from models.personnel import Personnel
from models.safety import MedicalAccessGrant, MedicalPermission, MedicalProfile
from models.user import User
from ui_api.common import record_audit
from ui_api.security import Principal, current_user, verify_password
from ui_api.throttle import login_throttle

router = APIRouter(prefix="/medical", tags=["ui: restricted medical"], dependencies=[Depends(current_user)])
ACCESS_SECONDS = 300


def no_store(response):
    response.headers["Cache-Control"] = "no-store, private"
    response.headers["Pragma"] = "no-cache"


def require_permission(db, user):
    if db.get(MedicalPermission, user.id) is None:
        record_audit(db, user, "medical_denied", "medical_access", str(user.id), "Denied: separate medical permission required")
        db.commit()
        raise HTTPException(403, "Separate medical-access permission is required, including for admins.",
                            headers={"Cache-Control": "no-store"})


def subject(db, scope):
    kind, _, id = scope.partition(":")
    if kind == "incident":
        incident = get_or_404(db, EmergencyIncident, id, "Incident")
        if incident.status == "resolved" or not incident.personnel_id:
            raise HTTPException(403, "Quick-card access requires an open incident with an affected person.")
        return get_or_404(db, Personnel, incident.personnel_id, "Personnel")
    if kind == "profile":
        return get_or_404(db, Personnel, id, "Personnel")
    raise HTTPException(400, "Access scope must identify an incident or personnel profile.")


class AccessBody(BaseModel):
    scope: str = Field(max_length=100)
    password: str = Field(min_length=1, max_length=256)
    reason: str = Field(min_length=8, max_length=500)


@router.get("/permission")
def permission(response: Response, db: Session = Depends(get_db), user: Principal = Depends(current_user)):
    no_store(response)
    return {"data": {"permitted": db.get(MedicalPermission, user.id) is not None, "access_seconds": ACCESS_SECONDS}}


@router.post("/access")
def unlock(body: AccessBody, request: Request, response: Response, db: Session = Depends(get_db),
           user: Principal = Depends(current_user)):
    no_store(response)
    require_permission(db, user)
    subject(db, body.scope)
    if len(body.reason.strip()) < 8:
        raise HTTPException(400, "Record a meaningful reason for accessing clinical information.")
    attempt = (request.client.host if request.client else "unknown", "medical:" + str(user.id))
    wait = login_throttle.retry_after(attempt)
    if wait:
        raise HTTPException(429, f"Too many verification attempts. Try again in {wait} seconds.")
    account = db.get(User, user.id)
    if account is None or not verify_password(body.password, account.password_hash):
        login_throttle.record_failure(attempt)
        record_audit(db, user, "medical_denied", "medical_access", body.scope, "Denied: password confirmation failed")
        db.commit()
        raise HTTPException(403, "Password confirmation failed.")
    login_throttle.clear(attempt)
    token = secrets.token_urlsafe(32)
    expires = utcnow() + timedelta(seconds=ACCESS_SECONDS)
    db.add(MedicalAccessGrant(token_hash=hashlib.sha256(token.encode()).hexdigest(), user_id=user.id,
                              scope=body.scope, reason=body.reason.strip(), expires_at=expires))
    record_audit(db, user, "medical_unlock", "medical_access", body.scope,
                 f"Clinical access unlocked for 5 minutes. Reason: {body.reason.strip()}")
    db.commit()
    return {"data": {"access_token": token, "expires_at": expires.isoformat() + "Z"}}


def check_access(db, user, scope, token):
    require_permission(db, user)  # revocation takes effect immediately, even during a grant
    grant = db.get(MedicalAccessGrant, hashlib.sha256((token or "").encode()).hexdigest())
    if not grant or grant.user_id != user.id or grant.scope != scope or grant.expires_at <= utcnow():
        record_audit(db, user, "medical_denied", "medical_access", scope, "Denied: invalid, mismatched or expired access grant")
        db.commit()
        raise HTTPException(403, "Clinical access is locked or expired. Confirm your password and reason again.",
                            headers={"Cache-Control": "no-store"})
    return subject(db, scope)


def profile_view(profile, person):
    return {"personnel_id": person.id, "personnel_name": person.name, "registered": profile is not None,
            "blood_type": profile.blood_type if profile else "Unknown",
            "allergies": profile.allergies if profile else "Not recorded",
            "known_conditions": profile.known_conditions if profile else "Not recorded",
            "updated_at": profile.updated_at.isoformat() + "Z" if profile else None}


@router.get("/records/{kind}/{record_id}")
def read_profile(kind: Literal["incident", "profile"], record_id: str, response: Response,
                 x_medical_access: Optional[str] = Header(default=None), db: Session = Depends(get_db),
                 user: Principal = Depends(current_user)):
    no_store(response)
    scope = f"{kind}:{record_id}"
    person = check_access(db, user, scope, x_medical_access)
    profile = db.get(MedicalProfile, person.id)
    record_audit(db, user, "medical_read", "medical_access", scope, "Viewed restricted critical-info card")
    db.commit()
    return {"data": profile_view(profile, person)}


class ProfileBody(BaseModel):
    blood_type: Literal["Unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] = "Unknown"
    allergies: str = Field(min_length=1, max_length=2000)
    known_conditions: str = Field(min_length=1, max_length=2000)


@router.patch("/records/profile/{personnel_id}")
def update_profile(personnel_id: str, body: ProfileBody, response: Response,
                   x_medical_access: Optional[str] = Header(default=None), db: Session = Depends(get_db),
                   user: Principal = Depends(current_user)):
    no_store(response)
    scope = f"profile:{personnel_id}"
    person = check_access(db, user, scope, x_medical_access)
    if not body.allergies.strip() or not body.known_conditions.strip():
        raise HTTPException(400, "Use 'Not recorded' for unknown information; do not leave clinical fields blank.")
    profile = db.get(MedicalProfile, person.id)
    if profile is None:
        profile = MedicalProfile(personnel_id=person.id)
        db.add(profile)
    profile.blood_type, profile.allergies, profile.known_conditions = body.blood_type, body.allergies.strip(), body.known_conditions.strip()
    profile.updated_at = utcnow()
    record_audit(db, user, "medical_update", "medical_access", scope, "Updated restricted critical-info registration (values excluded)")
    db.commit()
    return {"data": profile_view(profile, person)}


@router.post("/lock")
def lock(response: Response, x_medical_access: Optional[str] = Header(default=None), db: Session = Depends(get_db),
         user: Principal = Depends(current_user)):
    no_store(response)
    grant = db.get(MedicalAccessGrant, hashlib.sha256((x_medical_access or "").encode()).hexdigest())
    if grant and grant.user_id == user.id:
        db.delete(grant)
        db.commit()
    return {"locked": True}
