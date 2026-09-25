# OWNER: Maisha
# Fields: id, name, start_date, end_date, status (planned/in_progress/completed),
#         team_lead_id, waypoints[], personnel_ids[], cargo_ids[], risk_score, risk_factors[]
# waypoints / personnel_ids / cargo_ids are relationships; risk_score / risk_factors are computed on read.
from sqlalchemy import Column, Date, ForeignKey, String, Table
from sqlalchemy.orm import relationship

from db import Base

expedition_personnel = Table(
    "expedition_personnel",
    Base.metadata,
    Column("expedition_id", String, ForeignKey("expeditions.id"), primary_key=True),
    Column("personnel_id", String, ForeignKey("personnel.id"), primary_key=True),
)


class Expedition(Base):
    __tablename__ = "expeditions"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(String, nullable=False, default="planned")  # planned / in_progress / completed
    team_lead_id = Column(String, ForeignKey("personnel.id"), nullable=True)

    waypoints = relationship(
        "Waypoint",
        back_populates="expedition",
        cascade="all, delete-orphan",
        order_by="Waypoint.sequence",
    )
    personnel = relationship("Personnel", secondary=expedition_personnel, order_by="Personnel.id")
    team_lead = relationship("Personnel", foreign_keys=[team_lead_id])
    # Cargo owns the link (cargo_items.expedition_id); this is a read-only view of it.
    cargo_items = relationship("CargoItem", viewonly=True, order_by="CargoItem.id")
