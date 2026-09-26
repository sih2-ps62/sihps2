import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Pagination from "./Pagination";

describe("Pagination", () => {
  it("renders nothing when there is only one page", () => {
    const { container } = render(<Pagination page={1} totalPages={1} total={3} onPageChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("disables the previous button on the first page", () => {
    render(<Pagination page={1} totalPages={3} total={30} onPageChange={vi.fn()} />);
    expect(screen.getByLabelText("Previous page")).toBeDisabled();
    expect(screen.getByLabelText("Next page")).toBeEnabled();
  });

  it("disables the next button on the last page", () => {
    render(<Pagination page={3} totalPages={3} total={30} onPageChange={vi.fn()} />);
    expect(screen.getByLabelText("Next page")).toBeDisabled();
    expect(screen.getByLabelText("Previous page")).toBeEnabled();
  });

  it("calls onPageChange with the next page number when clicked", async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} totalPages={5} total={50} onPageChange={onPageChange} />);
    await userEvent.click(screen.getByLabelText("Next page"));
    expect(onPageChange).toHaveBeenCalledWith(3);
    await userEvent.click(screen.getByLabelText("Previous page"));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});
