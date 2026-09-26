# OWNER: integration (Day 2-3)
# Password hashing (salted scrypt, stdlib only) and stateless JWT sessions for the frontend API.
import hashlib
import hmac
import logging
import os
import secrets
import time
from dataclasses import dataclass
from typing import Optional

import jwt
from fastapi import Depends, Header, HTTPException

log = logging.getLogger("polarops")

_DEV_SECRET = "polarops-dev-secret-change-me-before-deploying"
JWT_SECRET = os.getenv("POLAROPS_JWT_SECRET") or os.getenv("JWT_SECRET") or _DEV_SECRET
TOKEN_TTL_SECONDS = 12 * 60 * 60


def warn_if_dev_secret() -> None:
    if JWT_SECRET == _DEV_SECRET:
        log.warning("POLAROPS_JWT_SECRET (or JWT_SECRET) is not set - using the built-in dev secret. "
                    "Set it before any real deployment.")


_SCRYPT = {"n": 2**14, "r": 8, "p": 1, "dklen": 32}


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, **_SCRYPT)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt_hex, digest_hex = stored.split("$")
        if scheme != "scrypt":
            return False
        digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), **_SCRYPT)
        return hmac.compare_digest(digest, bytes.fromhex(digest_hex))
    except (ValueError, TypeError):
        return False


# Verified against when the email is unknown, so a missing account costs the same time as a wrong password.
_DUMMY_HASH = hash_password(secrets.token_urlsafe(12))


@dataclass(frozen=True)
class Principal:
    id: int
    email: str
    name: str
    role: str


def create_token(user) -> str:
    now = int(time.time())
    claims = {"sub": str(user.id), "email": user.email, "name": user.name, "role": user.role,
              "iat": now, "exp": now + TOKEN_TTL_SECONDS}
    return jwt.encode(claims, JWT_SECRET, algorithm="HS256")


def current_user(authorization: Optional[str] = Header(default=None)) -> Principal:
    token = authorization[7:].strip() if authorization and authorization.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Missing authorization token.")
    try:
        claims = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return Principal(id=int(claims["sub"]), email=claims["email"], name=claims["name"], role=claims["role"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token.")


def require_admin(user: Principal = Depends(current_user)) -> Principal:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="You do not have permission to perform this action.")
    return user
