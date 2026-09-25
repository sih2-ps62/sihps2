# OWNER: Jalak
# Fields: id, name, category, weight_kg, expedition_id, current_station_id,
#         status (stored/in_transit/delivered)
from sqlalchemy import Column, Float, ForeignKey, String

from db import Base


class CargoItem(Base):
    __tablename__ = "cargo_items"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    weight_kg = Column(Float, nullable=False)
    expedition_id = Column(String, ForeignKey("expeditions.id"), nullable=True)
    current_station_id = Column(String, ForeignKey("stations.id"), nullable=True)
    status = Column(String, nullable=False, default="stored")  # stored / in_transit / delivered
