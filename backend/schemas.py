# OWNER: Param
# Pydantic schemas for all entities — request and response shapes of docs/API_CONTRACT.md.
# Frozen at 09:00 Day 1 — no field changes without a team conversation.
from datetime import date, datetime, timezone
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, model_validator


def _iso_utc(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


UtcDateTime = Annotated[datetime, PlainSerializer(_iso_utc, return_type=str)]

StationType = Literal["base", "ship", "camp"]
StationStatus = Literal["operational", "degraded", "offline"]
ExpeditionStatus = Literal["planned", "in_progress", "completed"]
WaypointStatus = Literal["pending", "reached"]
CargoStatus = Literal["stored", "in_transit", "delivered", "delayed"]
InventoryStatus = Literal["ok", "low"]
AssetCategory = Literal["vehicle", "comms", "shelter", "medical", "power"]
AssetCondition = Literal["operational", "needs_maintenance", "retired"]
HolderType = Literal["station", "expedition"]
PersonnelStatus = Literal["at_base", "in_transit", "on_expedition", "overdue", "emergency", "on_leave"]
Severity = Literal["low", "medium", "high"]
IncidentStatus = Literal["open", "responding", "resolved"]
RiskBand = Literal["low", "medium", "high"]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------- Station (Maisha)
class StationOut(ORMModel):
    id: str
    name: str
    type: StationType
    lat: float
    lng: float
    status: StationStatus


# ---------------------------------------------------------------- Expedition / Waypoint (Maisha)
class WaypointOut(ORMModel):
    id: str
    expedition_id: str
    station_id: str
    sequence: int
    eta: Optional[UtcDateTime] = None
    status: WaypointStatus


class WaypointIn(BaseModel):
    """Existing waypoint when `id` is given (only supplied fields change); otherwise a new one."""
    id: Optional[str] = None
    station_id: Optional[str] = None
    eta: Optional[datetime] = None
    status: Optional[WaypointStatus] = None


class RiskFactor(BaseModel):
    factor: str
    contribution: int


class ExpeditionOut(BaseModel):
    id: str
    name: str
    start_date: date
    end_date: Optional[date] = None
    status: ExpeditionStatus
    team_lead_id: Optional[str] = None
    waypoints: list[WaypointOut]
    personnel_ids: list[str]
    cargo_ids: list[str]
    risk_score: int
    risk_factors: list[RiskFactor]


class ExpeditionCreate(BaseModel):
    name: str = Field(min_length=1)
    start_date: date
    end_date: date
    status: ExpeditionStatus = "planned"
    team_lead_id: Optional[str] = None
    waypoints: list[WaypointIn] = []
    personnel_ids: list[str] = []
    cargo_ids: list[str] = []

    @model_validator(mode="after")
    def _dates_in_order(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must not be before start_date")
        return self


class ExpeditionUpdate(BaseModel):
    """PATCH body — only supplied fields change; lists replace the whole list."""
    name: Optional[str] = Field(default=None, min_length=1)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[ExpeditionStatus] = None
    team_lead_id: Optional[str] = None
    waypoints: Optional[list[WaypointIn]] = None
    personnel_ids: Optional[list[str]] = None
    cargo_ids: Optional[list[str]] = None


class RiskOut(BaseModel):
    expedition_id: str
    risk_score: int
    risk_band: RiskBand
    risk_factors: list[RiskFactor]
    generated_at: UtcDateTime


# ---------------------------------------------------------------- Cargo (Jalak)
class CargoOut(ORMModel):
    id: str
    name: str
    category: str
    weight_kg: float
    expedition_id: Optional[str] = None
    current_station_id: Optional[str] = None
    status: CargoStatus


class CargoCreate(BaseModel):
    name: str = Field(min_length=1)
    category: str = Field(min_length=1)
    weight_kg: float = Field(gt=0)
    expedition_id: Optional[str] = None
    current_station_id: Optional[str] = None
    status: CargoStatus = "stored"


class CargoUpdate(BaseModel):
    status: Optional[CargoStatus] = None
    current_station_id: Optional[str] = None


# ---------------------------------------------------------------- Inventory (Jalak)
class InventoryOut(ORMModel):
    id: str
    name: str
    category: str
    station_id: Optional[str] = None
    quantity: int
    unit: str
    reorder_threshold: int
    status: InventoryStatus


class InventoryCreate(BaseModel):
    name: str = Field(min_length=1)
    category: str = Field(min_length=1)
    station_id: str
    quantity: int = Field(ge=0)
    unit: str = Field(min_length=1)
    reorder_threshold: int = Field(ge=0)


class InventoryAdjust(BaseModel):
    """Exactly one of: delta (signed change) or quantity (absolute new level)."""
    delta: Optional[int] = None
    quantity: Optional[int] = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _exactly_one(self):
        if (self.delta is None) == (self.quantity is None):
            raise ValueError("provide exactly one of delta or quantity")
        return self


# ---------------------------------------------------------------- Asset (Jalak)
class AssetOut(ORMModel):
    id: str
    name: str
    category: AssetCategory
    condition: AssetCondition
    current_holder_type: HolderType
    current_holder_id: str
    last_inspected: Optional[date] = None


class AssetCreate(BaseModel):
    name: str = Field(min_length=1)
    category: AssetCategory
    condition: AssetCondition = "operational"
    current_holder_type: HolderType
    current_holder_id: str
    last_inspected: Optional[date] = None


class AssetUpdate(BaseModel):
    condition: Optional[AssetCondition] = None
    current_holder_type: Optional[HolderType] = None
    current_holder_id: Optional[str] = None
    last_inspected: Optional[date] = None


# ---------------------------------------------------------------- Personnel (Param)
class PersonnelOut(ORMModel):
    id: str
    name: str
    role: str
    current_station_id: Optional[str] = None
    status: PersonnelStatus
    last_checkin: UtcDateTime


# ---------------------------------------------------------------- Emergency (Param)
class EmergencyOut(ORMModel):
    id: str
    type: str
    personnel_id: Optional[str] = None
    station_id: Optional[str] = None
    severity: Severity
    description: str
    status: IncidentStatus
    timestamp: UtcDateTime
    escalated_at: Optional[UtcDateTime] = None


class EmergencyCreate(BaseModel):
    type: str = Field(min_length=1)
    personnel_id: Optional[str] = None
    station_id: Optional[str] = None
    severity: Severity = "medium"
    description: str = ""

    @model_validator(mode="after")
    def _needs_a_subject(self):
        if self.personnel_id is None and self.station_id is None:
            raise ValueError("provide personnel_id and/or station_id")
        return self


class EmergencyUpdate(BaseModel):
    status: IncidentStatus


# ---------------------------------------------------------------- Dashboard / health (Param)
class DashboardSummary(BaseModel):
    active_expeditions: int
    cargo_in_transit: int
    low_stock_items: int
    overdue_personnel: int
    active_emergencies: int
    escalated_emergencies: int
    maintenance_due_assets: int
    generated_at: UtcDateTime


class HealthOut(BaseModel):
    status: Literal["ok"]
    seeded: bool
    time: UtcDateTime
