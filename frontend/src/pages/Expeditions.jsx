import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import Button from "../components/ui/Button";
import FilterChip from "../components/ui/FilterChip";
import SearchInput from "../components/ui/SearchInput";
import DataTable from "../components/ui/DataTable";
import Pagination from "../components/ui/Pagination";
import StatusBadge from "../components/ui/StatusBadge";
import NewExpeditionModal from "../components/expeditions/NewExpeditionModal";
import { useListState } from "../hooks/useListState";
import { useQuery } from "../hooks/useApi";
import { api } from "../lib/api";

const filters = ["All", "Active", "Planned", "Completed"];
const STATUS_TONE = { Active: "ok", Planned: "neutral", Completed: "neutral" };

export default function Expeditions() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const list = useListState({ defaultSort: "start_date" });
  const [activeFilter, setActiveFilter] = useState("All");

  const { data: stationsResult } = useQuery(() => api.get("/stations"), []);
  const stations = stationsResult?.data ?? [];

  const { data, isLoading, refetch } = useQuery(
    () => api.get("/expeditions", { ...list.params, status: activeFilter === "All" ? undefined : activeFilter }),
    [list.params.page, list.params.sort, list.params.order, list.params.q, activeFilter]
  );

  const columns = [
    { key: "name", label: "Expedition", sortable: true },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row) => <StatusBadge label={row.status} tone={STATUS_TONE[row.status]} />,
    },
    { key: "region", label: "Region", sortable: true },
    { key: "start_date", label: "Start Date", sortable: true },
    { key: "team_lead", label: "Team Lead" },
  ];

  return (
    <div className="flex flex-col gap-4 px-6 py-6 md:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((filter) => (
            <FilterChip
              key={filter}
              label={filter}
              active={activeFilter === filter}
              onClick={() => setActiveFilter(filter)}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={list.q} onChange={list.updateSearch} placeholder="Search expeditions…" />
          <Button icon={Plus} onClick={() => setIsModalOpen(true)}>
            New Expedition
          </Button>
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Expedition Routes</h2>
          <p className="text-sm text-text-secondary">Assignments, timelines & waypoints</p>
        </div>
        <DataTable
          columns={columns}
          rows={data?.data ?? []}
          sort={list.sort}
          order={list.order}
          onSortChange={list.toggleSort}
          onRowClick={(row) => navigate(`/expeditions/${row.id}`)}
          isLoading={isLoading}
          emptyMessage="No expeditions match your filters."
        />
        <Pagination page={data?.page ?? 1} totalPages={data?.totalPages ?? 1} total={data?.total ?? 0} onPageChange={list.setPage} />
      </div>

      <NewExpeditionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        stations={stations}
        onCreated={refetch}
      />
    </div>
  );
}
