import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Modal from "./Modal";

// Mirrors how every "New ___" modal is written: form state lives in the parent and onClose is a fresh function on
// every render.
function FormInModal({ onClosed }) {
  const [text, setText] = useState("");
  const handleClose = () => onClosed(text);
  return (
    <Modal isOpen onClose={handleClose} title="Demo form">
      <input aria-label="Name" value={text} onChange={(event) => setText(event.target.value)} />
    </Modal>
  );
}

describe("Modal", () => {
  it("keeps the cursor in the field while typing (regression: focus jumped to the close button after each letter)", async () => {
    render(<FormInModal onClosed={() => {}} />);
    const field = screen.getByLabelText("Name");

    await userEvent.click(field);
    await userEvent.type(field, "Ross Sea Circuit");

    expect(field).toHaveValue("Ross Sea Circuit");
    expect(field).toHaveFocus();
    expect(screen.getByRole("dialog", { name: "Demo form" })).toBeInTheDocument();
  });

  it("focuses the close button once, when it opens", () => {
    render(<FormInModal onClosed={() => {}} />);
    expect(screen.getByLabelText("Close dialog")).toHaveFocus();
  });

  it("Escape closes it using the latest onClose, not the one from when it opened", async () => {
    const onClosed = vi.fn();
    render(<FormInModal onClosed={onClosed} />);
    await userEvent.type(screen.getByLabelText("Name"), "abc");
    await userEvent.keyboard("{Escape}");
    expect(onClosed).toHaveBeenCalledWith("abc");
  });
});
