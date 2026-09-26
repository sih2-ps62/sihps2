import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import Reveal from "./Reveal";

export default function DetailShell({ backTo, backLabel, title, subtitle, action, children }) {
  return (
    <div className="flex flex-col gap-4 px-6 py-6 md:px-8">
      <Link
        to={backTo}
        className="focus-ring flex w-fit items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors duration-150 hover:text-text-primary"
      >
        <ChevronLeft size={16} strokeWidth={1.75} />
        {backLabel}
      </Link>
      <Reveal className="glass-card flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">{title}</h1>
            {subtitle && <p className="text-sm text-text-secondary">{subtitle}</p>}
          </div>
          {action}
        </div>
        {children}
      </Reveal>
    </div>
  );
}
