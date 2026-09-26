import { useState } from "react";
import { History } from "lucide-react";
import FilterChip from "../components/ui/FilterChip";
import SearchInput from "../components/ui/SearchInput";
import DataTable from "../components/ui/DataTable";
import Pagination from "../components/ui/Pagination";
import StatusBadge from "../components/ui/StatusBadge";
import { useListState } from "../hooks/useListState";
import { useQuery } from "../hooks/useApi";
import { api } from "../lib/api";
import { formatRelativeTime } from "../lib/format";

const actionFilters = ["All", "create", "update", "delete"];
const ACTION_TONE = { create: "ok", update: "neutral", delete: "critical" };
const ACTION_LABEL = { create: "Created", update: "Updated", delete: "Deleted" };

export default function AuditLog() {
  const list = useListState({ defaultSort: "created_at", defaultOrder: "desc", pageSize: 15 });
  const [activeFilter, setActiveFilter] = useState("All");

  const { data, isLoading } = useQuery(
    () => api.get("/audit-log", { ...list.params, action: activeFilter === "All" ? undefined : activeFilter }),
    [list.params.page, list.params.sort, list.params.order, list.params.q, activeFilter]
  );

  const columns = [
    {
      key: "created_at",
      label: "When",
      sortable: true,
      render: (row) => formatRelativeTime(row.created_at),
    },
    { key: "user_name", label: "User", sortable: true },
    {
      key: "action",
      label: "Action",
      sortable: true,
      render: (row) => <StatusBadge label={ACTION_LABEL[row.action] ?? row.action} tone={ACTION_TONE[row.action]} />,
    },
    { key: "resource_type", label: "Resource", sortable: true },
    { key: "summary", label: "Details" },
  ];

  return (
    <div className="flex flex-col gap-4 px-6 py-6 md:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {actionFilters.map((filter) => (
            <FilterChip
              key={filter}
              label={filter === "All" ? "All" : ACTION_LABEL[filter]}
              active={activeFilter === filter}
              onClick={() => setActiveFilter(filter)}
            />
          ))}
        </div>
        <SearchInput value={list.q} onChange={list.updateSearch} placeholder="Search audit log…" />
      </div>

      <div className="glass-card p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="icon-chip">
            <History size={18} strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Activity Log</h2>
            <p className="text-sm text-text-secondary">Every create, update & delete across PolarOps</p>
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={data?.data ?? []}
          sort={list.sort}
          order={list.order}
          onSortChange={list.toggleSort}
          isLoading={isLoading}
          emptyMessage="No activity recorded yet."
        />
        <Pagination page={data?.page ?? 1} totalPages={data?.totalPages ?? 1} total={data?.total ?? 0} onPageChange={list.setPage} />
      </div>
    </div>
  );
}
