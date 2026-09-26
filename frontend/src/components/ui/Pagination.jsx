import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({ page, totalPages, total, onPageChange }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 pt-3">
      <p className="text-xs text-text-secondary">
        Page {page} of {totalPages} · {total} total
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors duration-150 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors duration-150 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
