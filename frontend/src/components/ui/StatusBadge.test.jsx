import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusBadge from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders the given label", () => {
    render(<StatusBadge label="Active" tone="ok" />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("applies the status-ok color classes for the 'ok' tone", () => {
    render(<StatusBadge label="Delivered" tone="ok" />);
    expect(screen.getByText("Delivered").className).toContain("text-status-ok");
  });

  it("applies the status-critical color classes for the 'critical' tone", () => {
    render(<StatusBadge label="Out of stock" tone="critical" />);
    expect(screen.getByText("Out of stock").className).toContain("text-status-critical");
  });

  it("falls back to the neutral tone when none is given", () => {
    render(<StatusBadge label="Pending" />);
    expect(screen.getByText("Pending").className).toContain("text-text-secondary");
  });
});
