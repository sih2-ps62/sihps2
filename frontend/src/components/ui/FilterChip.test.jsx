import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FilterChip from "./FilterChip";

describe("FilterChip", () => {
  it("reflects the active state via aria-pressed", () => {
    render(<FilterChip label="Active" active onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Active" })).toHaveAttribute("aria-pressed", "true");
  });

  it("reflects the inactive state via aria-pressed", () => {
    render(<FilterChip label="Planned" active={false} onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Planned" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<FilterChip label="All" onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: "All" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
