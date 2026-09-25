# OWNER: Maisha
# Fields: id, expedition_id, station_id, sequence, eta, status (pending/reached)
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from db import Base


class Waypoint(Base):
    __tablename__ = "waypoints"

    id = Column(String, primary_key=True)
    expedition_id = Column(String, ForeignKey("expeditions.id"), nullable=False)
    station_id = Column(String, ForeignKey("stations.id"), nullable=False)
    sequence = Column(Integer, nullable=False)
    eta = Column(DateTime, nullable=True)
    status = Column(String, nullable=False, default="pending")  # pending / reached

    expedition = relationship("Expedition", back_populates="waypoints")
    station = relationship("Station")
