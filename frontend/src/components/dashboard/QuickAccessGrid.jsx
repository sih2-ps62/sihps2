import { Link } from "react-router-dom";
import { quickAccessModules } from "../../data/modules";
import Reveal from "../ui/Reveal";

export default function QuickAccessGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {quickAccessModules.map((mod, idx) => {
        const Icon = mod.icon;
        return (
          <Reveal
            key={mod.id}
            as={Link}
            to={mod.target}
            delay={280 + idx * 40}
            className="glass-card glass-card-hover focus-ring group flex flex-col items-start gap-3 p-5 text-left"
          >
            <div className="icon-chip transition-transform duration-200 ease-out group-hover:scale-[1.03]">
              <Icon size={20} strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">{mod.label}</p>
              <p className="text-xs text-text-secondary">{mod.description}</p>
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}
