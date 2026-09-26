import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Package, Truck, CheckCircle2, Clock } from "lucide-react";
import Button from "../components/ui/Button";
import FilterChip from "../components/ui/FilterChip";
import SearchInput from "../components/ui/SearchInput";
import DataTable from "../components/ui/DataTable";
import Pagination from "../components/ui/Pagination";
import StatusBadge from "../components/ui/StatusBadge";
import StatStrip from "../components/ui/StatStrip";
import NewCargoModal from "../components/cargo/NewCargoModal";
import CargoStatusChart from "../components/cargo/CargoStatusChart";
import { useListState } from "../hooks/useListState";
import { useQuery } from "../hooks/useApi";
import { api } from "../lib/api";

const filters = ["All", "Pending", "In Transit", "Delivered", "Delayed"];
const STATUS_TONE = { Delivered: "ok", "In Transit": "neutral", Delayed: "warning", Pending: "neutral" };

const cargoStatItems = [
  { id: "total", statKey: "totalShipments", label: "Total Shipments", icon: Package },
  { id: "transit", statKey: "inTransit", label: "In Transit", icon: Truck },
  { id: "delivered", statKey: "delivered", label: "Delivered", icon: CheckCircle2 },
  { id: "delayed", statKey: "delayed", label: "Delayed", icon: Clock },
];

export default function Cargo() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const list = useListState({ defaultSort: "created_at", defaultOrder: "desc" });
  const [activeFilter, setActiveFilter] = useState("All");

  const { data: statsResult } = useQuery(() => api.get("/stats"), []);
  const statItemsWithValues = cargoStatItems.map((item) => ({
    ...item,
    value: statsResult?.cargo?.[item.statKey],
  }));

  const { data, isLoading, refetch } = useQuery(
    () => api.get("/cargo", { ...list.params, status: activeFilter === "All" ? undefined : activeFilter }),
    [list.params.page, list.params.sort, list.params.order, list.params.q, activeFilter]
  );

  const columns = [
    { key: "manifest_id", label: "Manifest", sortable: true },
    { key: "description", label: "Description", sortable: true },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row) => <StatusBadge label={row.status} tone={STATUS_TONE[row.status]} />,
    },
    { key: "origin", label: "Origin" },
    { key: "destination", label: "Destination" },
    { key: "weight_kg", label: "Weight (kg)", sortable: true },
  ];

  return (
    <div className="flex flex-col gap-4 px-6 py-6 md:px-8">
      <StatStrip items={statItemsWithValues} delay={0} />

      {statsResult?.cargo && <CargoStatusChart stats={statsResult.cargo} delay={40} />}

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
          <SearchInput value={list.q} onChange={list.updateSearch} placeholder="Search manifests…" />
          <Button icon={Plus} onClick={() => setIsModalOpen(true)}>
            New Shipment
          </Button>
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Cargo Manifest</h2>
          <p className="text-sm text-text-secondary">Shipment tracking & delivery status</p>
        </div>
        <DataTable
          columns={columns}
          rows={data?.data ?? []}
          sort={list.sort}
          order={list.order}
          onSortChange={list.toggleSort}
          onRowClick={(row) => navigate(`/cargo/${row.id}`)}
          isLoading={isLoading}
          emptyMessage="No cargo records match your filters."
        />
        <Pagination page={data?.page ?? 1} totalPages={data?.totalPages ?? 1} total={data?.total ?? 0} onPageChange={list.setPage} />
      </div>

      <NewCargoModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onCreated={refetch} />
    </div>
  );
}
