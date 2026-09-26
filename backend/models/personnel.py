# OWNER: Param
# Fields: id, name, role, current_station_id,
#         status (at_base/in_transit/on_expedition/overdue/emergency/on_leave), last_checkin
from sqlalchemy import Column, DateTime, ForeignKey, String

from db import Base


class Personnel(Base):
    __tablename__ = "personnel"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    current_station_id = Column(String, ForeignKey("stations.id"), nullable=True)
    status = Column(String, nullable=False, default="at_base")
    last_checkin = Column(DateTime, nullable=False)
    # Internal, not in the API: the status to restore when overdue/emergency clears.
    prior_status = Column(String, nullable=True)
