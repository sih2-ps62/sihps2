import { useState } from "react";

export function useListState({ defaultSort, defaultOrder = "asc", pageSize = 8 } = {}) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(defaultSort);
  const [order, setOrder] = useState(defaultOrder);
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({});

  const toggleSort = (key) => {
    if (sort === key) {
      setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setOrder("asc");
    }
    setPage(1);
  };

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const updateSearch = (value) => {
    setQ(value);
    setPage(1);
  };

  return {
    page,
    setPage,
    sort,
    order,
    q,
    filters,
    toggleSort,
    updateFilter,
    updateSearch,
    params: { page, pageSize, sort, order, q: q || undefined, ...filters },
  };
}
