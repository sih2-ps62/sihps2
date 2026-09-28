"""Additive safety tables: existing databases keep their operational records."""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from db import Base, utcnow


class ExpeditionManifest(Base):
    __tablename__ = "expedition_safety_manifests"
    expedition_id = Column(String, ForeignKey("expeditions.id"), primary_key=True)
    emergency_kit_id = Column(String, ForeignKey("assets.id"), nullable=True)


class CheckInEvent(Base):
    __tablename__ = "checkin_events"
    id = Column(Integer, primary_key=True, autoincrement=True)
    personnel_id = Column(String, ForeignKey("personnel.id"), nullable=False, index=True)
    expedition_id = Column(String, ForeignKey("expeditions.id"), nullable=True, index=True)
    station_id = Column(String, ForeignKey("stations.id"), nullable=True)
    expected_station_id = Column(String, ForeignKey("stations.id"), nullable=True)
    expected_waypoint_id = Column(String, nullable=True)
    outcome = Column(String, nullable=False)  # on_route / deviation / no_route / location_unreported
    timestamp = Column(DateTime, nullable=False, default=utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    review_note = Column(Text, nullable=True)


class EmergencyResource(Base):
    __tablename__ = "emergency_resources"
    incident_id = Column(String, ForeignKey("emergency_incidents.id"), primary_key=True)
    resource_type = Column(String, primary_key=True)  # asset / personnel
    resource_id = Column(String, primary_key=True)


class MedicalProfile(Base):
    __tablename__ = "medical_profiles"
    personnel_id = Column(String, ForeignKey("personnel.id"), primary_key=True)
    blood_type = Column(String, nullable=False, default="Unknown")
    allergies = Column(Text, nullable=False, default="Not recorded")
    known_conditions = Column(Text, nullable=False, default="Not recorded")
    updated_at = Column(DateTime, nullable=False, default=utcnow)


class MedicalPermission(Base):
    __tablename__ = "medical_permissions"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    granted_at = Column(DateTime, nullable=False, default=utcnow)


class MedicalAccessGrant(Base):
    __tablename__ = "medical_access_grants"
    token_hash = Column(String, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    scope = Column(String, nullable=False)
    reason = Column(Text, nullable=False)
    expires_at = Column(DateTime, nullable=False)
