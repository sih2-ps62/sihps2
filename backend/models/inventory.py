# OWNER: Jalak
# Fields: id, name, category, station_id, quantity, unit, reorder_threshold, status (ok/low)
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String

from db import Base, utcnow


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    station_id = Column(String, ForeignKey("stations.id"), nullable=True)  # null = not yet assigned to a station
    quantity = Column(Integer, nullable=False)
    unit = Column(String, nullable=False)
    reorder_threshold = Column(Integer, nullable=False)
    status = Column(String, nullable=False, default="ok")  # ok / low — recomputed by rules/low_stock.py
    needs_maintenance = Column(Boolean, nullable=False, default=False)  # frontend (/api) equipment flag
    created_at = Column(DateTime, nullable=False, default=utcnow)
    updated_at = Column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)
