import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Users, UserCheck, UserMinus, Building2 } from "lucide-react";
import Button from "../components/ui/Button";
import FilterChip from "../components/ui/FilterChip";
import SearchInput from "../components/ui/SearchInput";
import DataTable from "../components/ui/DataTable";
import Pagination from "../components/ui/Pagination";
import StatusBadge from "../components/ui/StatusBadge";
import StatStrip from "../components/ui/StatStrip";
import NewPersonnelModal from "../components/personnel/NewPersonnelModal";
import { useListState } from "../hooks/useListState";
import { useQuery } from "../hooks/useApi";
import { api } from "../lib/api";

const filters = ["All", "In Field", "On Leave", "Base"];
const STATUS_TONE = { "In Field": "ok", "On Leave": "neutral", Base: "neutral" };

const personnelStatItems = [
  { id: "total", statKey: "totalStaff", label: "Total Staff", icon: Users },
  { id: "field", statKey: "inField", label: "In Field", icon: UserCheck },
  { id: "leave", statKey: "onLeave", label: "On Leave", icon: UserMinus },
  { id: "stations", statKey: "stations", label: "Stations", icon: Building2 },
];

export default function Personnel() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const list = useListState({ defaultSort: "name" });
  const [activeFilter, setActiveFilter] = useState("All");

  const { data: statsResult, refetch: refreshStats } = useQuery(() => api.get("/stats"), []);
  const statItemsWithValues = personnelStatItems.map((item) => ({
    ...item,
    value: statsResult?.personnel?.[item.statKey],
  }));

  const { data: stationsResult } = useQuery(() => api.get("/stations"), []);
  const stations = stationsResult?.data ?? [];

  const { data, isLoading, refetch } = useQuery(
    () => api.get("/personnel", { ...list.params, status: activeFilter === "All" ? undefined : activeFilter }),
    [list.params.page, list.params.sort, list.params.order, list.params.q, activeFilter]
  );

  const columns = [
    { key: "name", label: "Name", sortable: true },
    { key: "role", label: "Role", sortable: true },
    { key: "station_name", label: "Station", render: (row) => row.station_name || "Unassigned" },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row) => <StatusBadge label={row.status} tone={STATUS_TONE[row.status]} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4 px-6 py-6 md:px-8">
      <StatStrip items={statItemsWithValues} delay={0} />

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
          <SearchInput value={list.q} onChange={list.updateSearch} placeholder="Search personnel…" />
          <Button icon={Plus} onClick={() => setIsModalOpen(true)}>
            Add Personnel
          </Button>
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Field Roster</h2>
          <p className="text-sm text-text-secondary">Assignments & station coverage</p>
        </div>
        <DataTable
          columns={columns}
          rows={data?.data ?? []}
          sort={list.sort}
          order={list.order}
          onSortChange={list.toggleSort}
          onRowClick={(row) => navigate(`/personnel/${row.id}`)}
          isLoading={isLoading}
          emptyMessage="No personnel match your filters."
        />
        <Pagination page={data?.page ?? 1} totalPages={data?.totalPages ?? 1} total={data?.total ?? 0} onPageChange={list.setPage} />
      </div>

      <NewPersonnelModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        stations={stations}
        onCreated={() => {
          refetch();
          refreshStats();
        }}
      />
    </div>
  );
}
