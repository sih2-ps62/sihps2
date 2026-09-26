import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export default function DataTable({ columns, rows, sort, order, onSortChange, onRowClick, isLoading, emptyMessage }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => {
              const isSorted = sort === col.key;
              return (
                <th key={col.key} className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold text-text-secondary">
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(col.key)}
                      className="focus-ring flex items-center gap-1 rounded hover:text-text-primary"
                    >
                      {col.label}
                      {isSorted ? (
                        order === "asc" ? (
                          <ArrowUp size={12} strokeWidth={2} />
                        ) : (
                          <ArrowDown size={12} strokeWidth={2} />
                        )
                      ) : (
                        <ArrowUpDown size={12} strokeWidth={2} className="opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-sm text-text-secondary">
                Loading…
              </td>
            </tr>
          )}
          {!isLoading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-sm text-text-secondary">
                {emptyMessage || "No records found."}
              </td>
            </tr>
          )}
          {!isLoading &&
            rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-border/60 transition-colors duration-150 ${
                  onRowClick ? "cursor-pointer hover:bg-accent-soft/40" : ""
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="whitespace-nowrap px-3 py-3 text-text-primary">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
