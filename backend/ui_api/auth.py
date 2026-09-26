# OWNER: integration (Day 2-3)
# POST /api/auth/login, GET /api/auth/me
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import get_db
from models.user import User
from ui_api.security import _DUMMY_HASH, Principal, create_token, current_user, verify_password

router = APIRouter(prefix="/auth", tags=["ui: auth"])


class LoginBody(BaseModel):
    model_config = ConfigDict(extra="ignore")
    email: Optional[str] = None
    password: Optional[str] = None


def _public(user) -> dict:
    return {"id": user.id, "email": user.email, "name": user.name, "role": user.role}


@router.post("/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    if not body.email or not body.password:
        raise HTTPException(status_code=400, detail="Email and password are required.")
    user = db.execute(select(User).where(User.email == body.email.strip().lower())).scalars().first()
    password_ok = verify_password(body.password, user.password_hash if user else _DUMMY_HASH)
    if user is None or not password_ok:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return {"token": create_token(user), "user": _public(user)}


@router.get("/me")
def me(user: Principal = Depends(current_user)):
    return {"user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role}}
