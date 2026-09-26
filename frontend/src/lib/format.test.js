import { describe, expect, it, vi, afterEach } from "vitest";
import { formatRelativeTime } from "./format";

describe("formatRelativeTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for timestamps under a minute old", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:30Z"));
    expect(formatRelativeTime("2026-01-01 12:00:00")).toBe("just now");
  });

  it("formats minutes for timestamps under an hour old", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:15:00Z"));
    expect(formatRelativeTime("2026-01-01 12:00:00")).toBe("15m ago");
  });

  it("formats hours for timestamps under a day old", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T15:00:00Z"));
    expect(formatRelativeTime("2026-01-01 12:00:00")).toBe("3h ago");
  });

  it("formats days for older timestamps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-04T12:00:00Z"));
    expect(formatRelativeTime("2026-01-01 12:00:00")).toBe("3d ago");
  });

  it("returns an empty string for a missing timestamp", () => {
    expect(formatRelativeTime(null)).toBe("");
    expect(formatRelativeTime(undefined)).toBe("");
  });
});
