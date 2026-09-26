# OWNER: integration (Day 2-3)
# Append-only record of every create / update / delete made through the frontend API.
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String

from db import Base, utcnow


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_name = Column(String, nullable=False)
    action = Column(String, nullable=False)  # create / update / delete
    resource_type = Column(String, nullable=False)
    resource_id = Column(String, nullable=False)
    summary = Column(String, nullable=False)
    created_at = Column(DateTime, nullable=False, default=utcnow)
