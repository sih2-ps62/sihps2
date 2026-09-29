"""Additive planning inputs and reviewable drafts; never mutate operational stock."""
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text

from db import Base, utcnow


class ConsumptionProfile(Base):
    __tablename__ = "planning_consumption"
    inventory_id = Column(String, ForeignKey("inventory_items.id"), primary_key=True)
    daily_min = Column(Float, nullable=False)
    daily_max = Column(Float, nullable=False)
    basis = Column(String, nullable=False)  # station / person
    headcount = Column(Integer, nullable=True)  # verified planning occupancy, not inferred GPS
    reserve = Column(Float, nullable=False)
    note = Column(Text, nullable=False)
    updated_at = Column(DateTime, nullable=False, default=utcnow)


class SupplyArrival(Base):
    __tablename__ = "planning_arrivals"
    id = Column(String, primary_key=True)
    inventory_id = Column(String, ForeignKey("inventory_items.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    eta = Column(DateTime, nullable=False)
    asset_id = Column(String, ForeignKey("assets.id"), nullable=True)
    status = Column(String, nullable=False, default="expected")  # expected / received / cancelled
    note = Column(Text, nullable=False)
    updated_at = Column(DateTime, nullable=False, default=utcnow)


class SupplyLink(Base):
    __tablename__ = "planning_supply_links"
    id = Column(String, primary_key=True)
    source_id = Column(String, ForeignKey("inventory_items.id"), nullable=False)
    target_id = Column(String, ForeignKey("inventory_items.id"), nullable=False)
    asset_id = Column(String, ForeignKey("assets.id"), nullable=False)
    travel_hours = Column(Float, nullable=False)
    capacity = Column(Float, nullable=False)  # in matching inventory units, one trip
    mode = Column(String, nullable=False)
    enabled = Column(Boolean, nullable=False, default=True)
    note = Column(Text, nullable=False)  # operator's approval reference and operating assumptions
    updated_at = Column(DateTime, nullable=False, default=utcnow)


class RecoveryDraft(Base):
    __tablename__ = "planning_drafts"
    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    reason = Column(Text, nullable=False)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, nullable=False, default=utcnow)
    training = Column(Boolean, nullable=False, default=False)
    snapshot = Column(JSON, nullable=False)
