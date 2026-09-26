# OWNER: integration (Day 2-3)
# Operators who can sign in to the frontend. Passwords are stored as salted scrypt hashes (see ui_api/security.py).
from sqlalchemy import Column, DateTime, Integer, String

from db import Base, utcnow


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String, nullable=False, unique=True)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False, default="duty_officer")  # duty_officer / admin
    created_at = Column(DateTime, nullable=False, default=utcnow)
