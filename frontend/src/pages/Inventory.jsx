import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Boxes, AlertTriangle, PackageX, Layers } from "lucide-react";
import Button from "../components/ui/Button";
import FilterChip from "../components/ui/FilterChip";
import SearchInput from "../components/ui/SearchInput";
import DataTable from "../components/ui/DataTable";
import Pagination from "../components/ui/Pagination";
import StatusBadge from "../components/ui/StatusBadge";
import StatStrip from "../components/ui/StatStrip";
import NewInventoryModal from "../components/inventory/NewInventoryModal";
import StockLevelChart from "../components/inventory/StockLevelChart";
import ResupplySuggestions from "../components/inventory/ResupplySuggestions";
import AssetRegister from "../components/inventory/AssetRegister";
import { useListState } from "../hooks/useListState";
import { useQuery } from "../hooks/useApi";
import { api } from "../lib/api";

const filters = ["All", "Low Stock", "Needs Maintenance"];

const inventoryStatItems = [
  { id: "skus", statKey: "totalSkus", label: "Total SKUs", icon: Boxes },
  { id: "low", statKey: "lowStock", label: "Low Stock", icon: AlertTriangle },
  { id: "out", statKey: "outOfStock", label: "Out of Stock", icon: PackageX },
  { id: "categories", statKey: "categories", label: "Categories", icon: Layers },
];

function stockTone(row) {
  if (row.quantity === 0) return "critical";
  if (row.quantity <= row.threshold) return "warning";
  return "ok";
}

export default function Inventory() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const list = useListState({ defaultSort: "name" });
  const [activeFilter, setActiveFilter] = useState("All");

  const { data: statsResult } = useQuery(() => api.get("/stats"), []);
  const statItemsWithValues = inventoryStatItems.map((item) => ({
    ...item,
    value: statsResult?.inventory?.[item.statKey],
  }));

  const { data, isLoading, refetch } = useQuery(
    () =>
      api.get("/inventory", {
        ...list.params,
        lowStock: activeFilter === "Low Stock" ? "true" : undefined,
        needsMaintenance: activeFilter === "Needs Maintenance" ? "true" : undefined,
      }),
    [list.params.page, list.params.sort, list.params.order, list.params.q, activeFilter]
  );

  const { data: chartResult } = useQuery(() => api.get("/inventory", { pageSize: 100, sort: "name" }), []);

  const columns = [
    { key: "name", label: "Item", sortable: true },
    { key: "category", label: "Category", sortable: true },
    {
      key: "quantity",
      label: "Stock",
      sortable: true,
      render: (row) => (
        <StatusBadge label={`${row.quantity}/${row.threshold} ${row.unit}`} tone={stockTone(row)} />
      ),
    },
    {
      key: "needs_maintenance",
      label: "Maintenance",
      render: (row) => (row.needs_maintenance ? <StatusBadge label="Needs attention" tone="warning" /> : "—"),
    },
  ];

  return (
    <div className="flex flex-col gap-4 px-6 py-6 md:px-8">
      <StatStrip items={statItemsWithValues} delay={0} />

      <Link to="/planning" className="glass-card focus-ring flex flex-wrap items-center justify-between gap-3 border-accent/25 p-4 transition-colors hover:bg-accent-soft">
        <div><p className="text-sm font-semibold">How long will these supplies last?</p><p className="mt-1 text-xs text-text-secondary">Forecast endurance and test delivery delays in Mission Planner.</p></div>
        <span className="text-sm font-semibold text-accent">Open planner →</span>
      </Link>

      {chartResult?.data?.length > 0 && <StockLevelChart items={chartResult.data} delay={40} />}

      <ResupplySuggestions delay={60} />
      <AssetRegister />

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
          <SearchInput value={list.q} onChange={list.updateSearch} placeholder="Search inventory…" />
          <Button icon={Plus} onClick={() => setIsModalOpen(true)}>
            New Item
          </Button>
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Stock Levels</h2>
          <p className="text-sm text-text-secondary">Supplies, equipment & consumables</p>
        </div>
        <DataTable
          columns={columns}
          rows={data?.data ?? []}
          sort={list.sort}
          order={list.order}
          onSortChange={list.toggleSort}
          onRowClick={(row) => navigate(`/inventory/${row.id}`)}
          isLoading={isLoading}
          emptyMessage="No inventory items match your filters."
        />
        <Pagination page={data?.page ?? 1} totalPages={data?.totalPages ?? 1} total={data?.total ?? 0} onPageChange={list.setPage} />
      </div>

      <NewInventoryModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onCreated={refetch} />
    </div>
  );
}
