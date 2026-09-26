// Correlates independent alert conditions (low stock, overdue personnel,
// open emergencies) that are hitting the same station at the same time.
// Pure logic, no fetching — Emergency.jsx builds the `conditions` input from
// already-fetched inventory/personnel/emergency data.

const OVERDUE_HOURS = 24;

export function isOverdueCheckin(person, now = Date.now()) {
  if (person.status !== "In Field") return false;
  if (!person.last_checkin) return true;
  const last = new Date(person.last_checkin.replace(" ", "T") + "Z").getTime();
  return (now - last) / (1000 * 60 * 60) > OVERDUE_HOURS;
}

export function buildConditions({ inventory = [], personnel = [], emergencies = [], now = Date.now() }) {
  const conditions = [];

  for (const item of inventory) {
    if (item.station_id && item.quantity <= item.threshold) {
      conditions.push({
        kind: "low_stock",
        station_id: item.station_id,
        label: `${item.name} stock below threshold (${item.quantity}/${item.threshold} ${item.unit})`,
        source: item,
      });
    }
  }

  for (const person of personnel) {
    if (person.station_id && isOverdueCheckin(person, now)) {
      conditions.push({
        kind: "overdue_personnel",
        station_id: person.station_id,
        label: person.name,
        source: person,
      });
    }
  }

  for (const emergency of emergencies) {
    if (emergency.station_id && emergency.status === "Open") {
      conditions.push({
        kind: "emergency",
        station_id: emergency.station_id,
        label: emergency.title,
        source: emergency,
      });
    }
  }

  return conditions;
}

function severityFor(kinds) {
  if (kinds.includes("emergency")) return "CRITICAL";
  if (kinds.length === 2 && kinds.includes("overdue_personnel")) return "HIGH";
  return "MEDIUM";
}

export function computeCompoundRisks(conditions) {
  const byStation = new Map();
  for (const condition of conditions) {
    if (!byStation.has(condition.station_id)) byStation.set(condition.station_id, []);
    byStation.get(condition.station_id).push(condition);
  }

  const risks = [];
  for (const [stationId, stationConditions] of byStation) {
    const kinds = [...new Set(stationConditions.map((c) => c.kind))];
    if (kinds.length < 2) continue;

    risks.push({
      stationId,
      severity: severityFor(kinds),
      conditions: stationConditions,
    });
  }

  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
  return risks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
