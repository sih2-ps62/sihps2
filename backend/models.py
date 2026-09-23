from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Text
)
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Station(Base):
    __tablename__ = "stations"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # base / ship / camp
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    status = Column(String, default="operational")


class Expedition(Base):
    __tablename__ = "expeditions"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    start_date = Column(String, nullable=False)
    end_date = Column(String, nullable=False)
    status = Column(String, default="planned")  # planned/in_progress/completed
    team_lead_id = Column(String, ForeignKey("personnel.id"), nullable=True)

    waypoints = relationship("Waypoint", back_populates="expedition", cascade="all, delete-orphan")
    cargo_items = relationship("CargoItem", back_populates="expedition")
    personnel = relationship("Personnel", secondary="expedition_personnel", back_populates="expeditions")


class ExpeditionPersonnel(Base):
    __tablename__ = "expedition_personnel"
    expedition_id = Column(String, ForeignKey("expeditions.id"), primary_key=True)
    personnel_id = Column(String, ForeignKey("personnel.id"), primary_key=True)


class Waypoint(Base):
    __tablename__ = "waypoints"
    id = Column(String, primary_key=True)
    expedition_id = Column(String, ForeignKey("expeditions.id"), nullable=False)
    station_id = Column(String, ForeignKey("stations.id"), nullable=False)
    sequence = Column(Integer, nullable=False)
    eta = Column(DateTime, nullable=True)
    status = Column(String, default="pending")  # pending/reached/at_risk

    expedition = relationship("Expedition", back_populates="waypoints")
    station = relationship("Station")


class Personnel(Base):
    __tablename__ = "personnel"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    current_station_id = Column(String, ForeignKey("stations.id"), nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    status = Column(String, default="at_base")  # at_base/in_transit/on_expedition/overdue/emergency
    last_checkin = Column(DateTime, default=utcnow)

    expeditions = relationship("Expedition", secondary="expedition_personnel", back_populates="personnel")


class CargoItem(Base):
    __tablename__ = "cargo_items"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    weight_kg = Column(Float, nullable=True)
    expedition_id = Column(String, ForeignKey("expeditions.id"), nullable=True)
    current_station_id = Column(String, ForeignKey("stations.id"), nullable=True)
    status = Column(String, default="stored")  # stored/in_transit/delivered
    is_critical_part = Column(Boolean, default=False)
    linked_asset_id = Column(String, ForeignKey("assets.id", use_alter=True), nullable=True)
    eta = Column(DateTime, nullable=True)  # used for delay-risk while in_transit

    expedition = relationship("Expedition", back_populates="cargo_items")


class InventoryItem(Base):
    __tablename__ = "inventory_items"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    station_id = Column(String, ForeignKey("stations.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String, default="units")
    reorder_threshold = Column(Float, nullable=False)
    status = Column(String, default="ok")  # ok/low


class EmergencyIncident(Base):
    __tablename__ = "emergency_incidents"
    id = Column(String, primary_key=True)
    type = Column(String, nullable=False)
    personnel_id = Column(String, ForeignKey("personnel.id"), nullable=True)
    station_id = Column(String, ForeignKey("stations.id"), nullable=True)
    severity = Column(String, default="low")  # low/medium/high/critical
    description = Column(Text, nullable=True)
    status = Column(String, default="open")  # open/responding/resolved
    timestamp = Column(DateTime, default=utcnow)
    auto_generated = Column(Boolean, default=False)
    resolution_notes = Column(Text, nullable=True)


class Asset(Base):
    __tablename__ = "assets"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=True)
    station_id = Column(String, ForeignKey("stations.id"), nullable=True)
    health_pct = Column(Float, default=100)
    status = Column(String, default="operational")  # operational/warning/maintenance/critical
    runtime_hours = Column(Float, default=0)
    next_maintenance_date = Column(String, nullable=True)
    awaiting_part_cargo_id = Column(String, ForeignKey("cargo_items.id"), nullable=True)


class AuditLogEntry(Base):
    __tablename__ = "audit_log"
    id = Column(String, primary_key=True)
    timestamp = Column(DateTime, default=utcnow)
    status = Column(String, default="info")  # info/success/warning/error
    module = Column(String, nullable=False)
    action_description = Column(String, nullable=False)
    target_id = Column(String, nullable=True)
    actor = Column(String, default="operator")


class Counter(Base):
    """Simple persistent counter table for generating sequential IDs."""
    __tablename__ = "counters"
    prefix = Column(String, primary_key=True)
    value = Column(Integer, default=0)
