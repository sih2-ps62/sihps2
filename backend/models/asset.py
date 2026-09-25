# OWNER: Jalak
# Fields: id, name, category (vehicle/comms/shelter/medical/power),
#         condition (operational/needs_maintenance/retired),
#         current_holder_type (station/expedition), current_holder_id, last_inspected
from sqlalchemy import Column, Date, String

from db import Base


class Asset(Base):
    __tablename__ = "assets"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    condition = Column(String, nullable=False, default="operational")
    current_holder_type = Column(String, nullable=False)  # station / expedition
    # Polymorphic reference (STN-… or EXP-…), so no database-level foreign key.
    current_holder_id = Column(String, nullable=False)
    last_inspected = Column(Date, nullable=True)
