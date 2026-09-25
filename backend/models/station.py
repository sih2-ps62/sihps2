# OWNER: Maisha
# Fields: id, name, type (base/ship/camp), lat, lng, status
from sqlalchemy import Column, Float, String

from db import Base


class Station(Base):
    __tablename__ = "stations"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # base / ship / camp
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    status = Column(String, nullable=False, default="operational")  # operational / degraded / offline
    # Simulated weather feed — server-side input to the route risk score, deliberately not in the API contract.
    weather_code = Column(String, nullable=False, default="clear")
