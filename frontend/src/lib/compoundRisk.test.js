import { describe, expect, it } from "vitest";
import { buildConditions, computeCompoundRisks, isOverdueCheckin } from "./compoundRisk";

const NOW = new Date("2026-09-26T12:00:00Z").getTime();

describe("isOverdueCheckin", () => {
  it("is false for personnel who are not In Field, regardless of check-in age", () => {
    expect(isOverdueCheckin({ status: "On Leave", last_checkin: "2020-01-01 00:00:00" }, NOW)).toBe(false);
    expect(isOverdueCheckin({ status: "Base", last_checkin: "2020-01-01 00:00:00" }, NOW)).toBe(false);
  });

  it("is true for an In Field person who has never checked in", () => {
    expect(isOverdueCheckin({ status: "In Field", last_checkin: null }, NOW)).toBe(true);
  });

  it("is false for an In Field person checked in under 6h ago", () => {
    expect(isOverdueCheckin({ status: "In Field", last_checkin: "2026-09-26 10:00:00" }, NOW)).toBe(false);
  });

  it("is true for an In Field person checked in over 6h ago", () => {
    expect(isOverdueCheckin({ status: "In Field", last_checkin: "2026-09-25 10:00:00" }, NOW)).toBe(true);
  });
  it("uses the same configured check-in window as the departure gate", () => {
    expect(isOverdueCheckin({ status: "In Field", last_checkin: "2026-09-26T04:00:00Z" }, NOW)).toBe(true);
    expect(isOverdueCheckin({ status: "In Field", last_checkin: "2026-09-26T04:00:00Z", checkin_window_hours: 12 }, NOW)).toBe(false);
  });
});

describe("buildConditions", () => {
  it("only includes inventory at or below threshold, with a station assigned", () => {
    const conditions = buildConditions({
      inventory: [
        { id: 1, name: "Fuel", station_id: "mcmurdo", quantity: 10, threshold: 50, unit: "L" },
        { id: 2, name: "Suits", station_id: "mcmurdo", quantity: 40, threshold: 30, unit: "sets" }, // not low
        { id: 3, name: "Rations", station_id: null, quantity: 1, threshold: 50, unit: "kits" }, // no station
      ],
    });
    expect(conditions).toHaveLength(1);
    expect(conditions[0]).toMatchObject({ kind: "low_stock", station_id: "mcmurdo" });
  });

  it("only includes open emergencies with a station assigned", () => {
    const conditions = buildConditions({
      emergencies: [
        { id: 1, title: "Fire", station_id: "vostok", status: "Open" },
        { id: 2, title: "Old incident", station_id: "vostok", status: "Resolved" },
      ],
    });
    expect(conditions).toHaveLength(1);
    expect(conditions[0]).toMatchObject({ kind: "emergency", station_id: "vostok", label: "Fire" });
  });

  it("only includes overdue In Field personnel", () => {
    const conditions = buildConditions({
      personnel: [
        { id: 1, name: "A", station_id: "alert", status: "In Field", last_checkin: "2020-01-01 00:00:00" },
        { id: 2, name: "B", station_id: "alert", status: "In Field", last_checkin: "2026-09-26 11:00:00" },
        { id: 3, name: "C", station_id: "alert", status: "On Leave", last_checkin: "2020-01-01 00:00:00" },
      ],
      now: NOW,
    });
    expect(conditions).toHaveLength(1);
    expect(conditions[0]).toMatchObject({ kind: "overdue_personnel", label: "A" });
  });
});

describe("computeCompoundRisks", () => {
  it("does not flag a station with only one condition kind, even with multiple items", () => {
    const risks = computeCompoundRisks([
      { kind: "low_stock", station_id: "mcmurdo", label: "Fuel" },
      { kind: "low_stock", station_id: "mcmurdo", label: "Rations" },
    ]);
    expect(risks).toHaveLength(0);
  });

  it("flags CRITICAL when an emergency is one of the co-occurring kinds", () => {
    const risks = computeCompoundRisks([
      { kind: "low_stock", station_id: "mcmurdo", label: "Fuel" },
      { kind: "emergency", station_id: "mcmurdo", label: "Fire" },
    ]);
    expect(risks).toHaveLength(1);
    expect(risks[0].severity).toBe("CRITICAL");
  });

  it("flags HIGH for exactly low_stock + overdue_personnel with no emergency", () => {
    const risks = computeCompoundRisks([
      { kind: "low_stock", station_id: "alert", label: "Fuel" },
      { kind: "overdue_personnel", station_id: "alert", label: "R. Sharma" },
    ]);
    expect(risks).toHaveLength(1);
    expect(risks[0].severity).toBe("HIGH");
  });

  it("three kinds present at once is still CRITICAL (emergency dominates)", () => {
    const risks = computeCompoundRisks([
      { kind: "low_stock", station_id: "vostok", label: "Fuel" },
      { kind: "overdue_personnel", station_id: "vostok", label: "P. Nair" },
      { kind: "emergency", station_id: "vostok", label: "Generator failure" },
    ]);
    expect(risks[0].severity).toBe("CRITICAL");
  });

  it("documents that MEDIUM is unreachable with exactly these 3 condition kinds", () => {
    // Spec's rule: CRITICAL (has emergency) > HIGH (2 kinds incl.
    // overdue_personnel, no emergency) > MEDIUM (otherwise). With only
    // {low_stock, overdue_personnel, emergency} as possible kinds, "otherwise"
    // would need 2+ kinds that are neither emergency nor overdue_personnel —
    // excluding both leaves only low_stock, so no pair can ever land there.
    // This is a property of the specified algorithm, not a gap in this
    // implementation — every 2-kind pairing resolves to CRITICAL or HIGH.
    const allPairs = [
      ["low_stock", "overdue_personnel"],
      ["low_stock", "emergency"],
      ["overdue_personnel", "emergency"],
    ];
    for (const [kindA, kindB] of allPairs) {
      const severity = computeCompoundRisks([
        { kind: kindA, station_id: "x" },
        { kind: kindB, station_id: "x" },
      ])[0].severity;
      expect(["CRITICAL", "HIGH"]).toContain(severity);
    }
  });

  it("preserves every individual condition on the qualifying station", () => {
    const risks = computeCompoundRisks([
      { kind: "low_stock", station_id: "mcmurdo", label: "Fuel" },
      { kind: "overdue_personnel", station_id: "mcmurdo", label: "E. Kowalski" },
    ]);
    expect(risks[0].conditions).toHaveLength(2);
  });

  it("sorts qualifying stations by severity, most severe first", () => {
    const risks = computeCompoundRisks([
      { kind: "low_stock", station_id: "alert", label: "Fuel" },
      { kind: "overdue_personnel", station_id: "alert", label: "R. Sharma" }, // HIGH
      { kind: "low_stock", station_id: "mcmurdo", label: "Fuel" },
      { kind: "emergency", station_id: "mcmurdo", label: "Fire" }, // CRITICAL
    ]);
    expect(risks.map((r) => r.severity)).toEqual(["CRITICAL", "HIGH"]);
  });
});
