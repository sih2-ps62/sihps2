import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <div className="icon-chip h-14 w-14">
        <Compass size={28} strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-2xl font-semibold text-text-primary">Page not found</p>
        <p className="text-sm text-text-secondary">This route doesn't exist in Operations Command.</p>
      </div>
      <Link
        to="/"
        className="focus-ring rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent/90"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
