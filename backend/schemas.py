from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------- Station
class StationOut(ORMBase):
    id: str
    name: str
    type: str
    lat: float
    lng: float
    status: str


# ------------------------------------------------------------------- Waypoint
class WaypointIn(BaseModel):
    station_id: str
    sequence: int
    eta: Optional[datetime] = None


class WaypointOut(ORMBase):
    id: str
    expedition_id: str
    station_id: str
    sequence: int
    eta: Optional[datetime] = None
    status: str


# ----------------------------------------------------------------- Expedition
class ExpeditionCreate(BaseModel):
    name: str
    start_date: str
    end_date: str
    team_lead_id: Optional[str] = None
    waypoints: List[WaypointIn] = Field(default_factory=list)
    cargo_ids: List[str] = Field(default_factory=list)
    personnel_ids: List[str] = Field(default_factory=list)


class ExpeditionUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None
    team_lead_id: Optional[str] = None
    waypoints: Optional[List[WaypointIn]] = None
    cargo_ids: Optional[List[str]] = None
    personnel_ids: Optional[List[str]] = None


class ExpeditionOut(ORMBase):
    id: str
    name: str
    start_date: str
    end_date: str
    status: str
    team_lead_id: Optional[str] = None


class ExpeditionDetailOut(ExpeditionOut):
    waypoints: List[WaypointOut] = Field(default_factory=list)
    cargo_ids: List[str] = Field(default_factory=list)
    personnel_ids: List[str] = Field(default_factory=list)


# --------------------------------------------------------------------- Cargo
class CargoCreate(BaseModel):
    name: str
    category: Optional[str] = None
    weight_kg: Optional[float] = None
    expedition_id: Optional[str] = None
    current_station_id: Optional[str] = None
    status: str = "stored"
    is_critical_part: bool = False
    linked_asset_id: Optional[str] = None
    eta: Optional[datetime] = None


class CargoUpdate(BaseModel):
    status: Optional[str] = None
    current_station_id: Optional[str] = None
    eta: Optional[datetime] = None
    expedition_id: Optional[str] = None


class CargoOut(ORMBase):
    id: str
    name: str
    category: Optional[str] = None
    weight_kg: Optional[float] = None
    expedition_id: Optional[str] = None
    current_station_id: Optional[str] = None
    status: str
    is_critical_part: bool
    linked_asset_id: Optional[str] = None
    eta: Optional[datetime] = None
    is_delayed: bool = False
    delayed_hours: float = 0


# ----------------------------------------------------------------- Inventory
class InventoryCreate(BaseModel):
    name: str
    category: Optional[str] = None
    station_id: str
    quantity: float
    unit: str = "units"
    reorder_threshold: float


class InventoryAdjust(BaseModel):
    delta: Optional[float] = None
    quantity: Optional[float] = None


class InventoryOut(ORMBase):
    id: str
    name: str
    category: Optional[str] = None
    station_id: str
    quantity: float
    unit: str
    reorder_threshold: float
    status: str


# ----------------------------------------------------------------- Personnel
class PersonnelCreate(BaseModel):
    name: str
    role: str
    current_station_id: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class PersonnelOut(ORMBase):
    id: str
    name: str
    role: str
    current_station_id: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    status: str
    last_checkin: Optional[datetime] = None
    distance_from_station_km: Optional[float] = None


# --------------------------------------------------------------- Emergency
class EmergencyCreate(BaseModel):
    type: str
    personnel_id: Optional[str] = None
    station_id: Optional[str] = None
    severity: str = "medium"
    description: Optional[str] = None


class EmergencyUpdate(BaseModel):
    status: Optional[str] = None
    severity: Optional[str] = None
    resolution_notes: Optional[str] = None


class EmergencyOut(ORMBase):
    id: str
    type: str
    personnel_id: Optional[str] = None
    station_id: Optional[str] = None
    severity: str
    description: Optional[str] = None
    status: str
    timestamp: datetime
    auto_generated: bool
    resolution_notes: Optional[str] = None


# ------------------------------------------------------------------- Asset
class AssetCreate(BaseModel):
    name: str
    type: Optional[str] = None
    station_id: Optional[str] = None
    health_pct: float = 100
    runtime_hours: float = 0
    next_maintenance_date: Optional[str] = None
    awaiting_part_cargo_id: Optional[str] = None


class AssetTelemetry(BaseModel):
    health_pct: Optional[float] = None
    runtime_hours: Optional[float] = None


class AssetOut(ORMBase):
    id: str
    name: str
    type: Optional[str] = None
    station_id: Optional[str] = None
    health_pct: float
    status: str
    runtime_hours: float
    next_maintenance_date: Optional[str] = None
    awaiting_part_cargo_id: Optional[str] = None


# --------------------------------------------------------------- Audit log
class AuditLogOut(ORMBase):
    id: str
    timestamp: datetime
    status: str
    module: str
    action_description: str
    target_id: Optional[str] = None
    actor: str


# ------------------------------------------------------------------ Alerts
class AlertOut(BaseModel):
    id: str
    type: str
    severity: str
    message: str
    linked: dict
    created_at: str


# --------------------------------------------------------------- Dashboard
class MissionReadiness(BaseModel):
    personnel: int
    cargo: int
    inventory: int
    assets: int
    emergency: int
    overall: int


class DashboardSummary(BaseModel):
    active_expeditions: int
    personnel_in_field: int
    cargo_in_transit: int
    low_stock_alerts: int
    open_emergencies: int
    overdue_checkins: int
    assets_operational_pct: int
    mission_readiness: MissionReadiness
    generated_at: str


# ----------------------------------------------------------------- Assistant
class AssistantQueryIn(BaseModel):
    question: str


class AssistantQueryOut(BaseModel):
    answer: str
    grounded: bool = True
    data: dict = Field(default_factory=dict)
