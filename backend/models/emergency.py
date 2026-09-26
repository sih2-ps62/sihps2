# OWNER: Param
# Fields: id, type, personnel_id, station_id, severity (low/medium/high),
#         description, status (open/responding/resolved), timestamp, escalated_at
from sqlalchemy import Column, DateTime, ForeignKey, String, Text

from db import Base


class EmergencyIncident(Base):
    __tablename__ = "emergency_incidents"

    id = Column(String, primary_key=True)
    type = Column(String, nullable=False)
    personnel_id = Column(String, ForeignKey("personnel.id"), nullable=True)
    station_id = Column(String, ForeignKey("stations.id"), nullable=True)
    severity = Column(String, nullable=False, default="medium")  # low / medium / high
    description = Column(Text, nullable=False, default="")
    status = Column(String, nullable=False, default="open")  # open / responding / resolved
    timestamp = Column(DateTime, nullable=False)
    escalated_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
