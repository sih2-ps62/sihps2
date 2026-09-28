import { cloneElement, useId } from "react";

export const inputClass =
  "focus-ring w-full rounded-xl border border-border bg-surface-solid px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/60";

export default function Field({ label, children }) {
  const generatedId = useId();
  const id = children.props.id || generatedId;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-text-secondary">{label}</label>
      {cloneElement(children, { id })}
    </div>
  );
}
