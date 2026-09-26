import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useListState } from "./useListState";

describe("useListState", () => {
  it("starts on page 1 with the given default sort and no search term", () => {
    const { result } = renderHook(() => useListState({ defaultSort: "name", pageSize: 5 }));
    expect(result.current.page).toBe(1);
    expect(result.current.sort).toBe("name");
    expect(result.current.order).toBe("asc");
    expect(result.current.q).toBe("");
    expect(result.current.params).toMatchObject({ page: 1, pageSize: 5, sort: "name", order: "asc" });
  });

  it("toggling the same sort column flips order instead of resetting it", () => {
    const { result } = renderHook(() => useListState({ defaultSort: "name" }));
    act(() => result.current.toggleSort("name"));
    expect(result.current.order).toBe("desc");
    act(() => result.current.toggleSort("name"));
    expect(result.current.order).toBe("asc");
  });

  it("switching to a different sort column resets order to ascending", () => {
    const { result } = renderHook(() => useListState({ defaultSort: "name" }));
    act(() => result.current.toggleSort("name"));
    expect(result.current.order).toBe("desc");
    act(() => result.current.toggleSort("status"));
    expect(result.current.sort).toBe("status");
    expect(result.current.order).toBe("asc");
  });

  it("resets to page 1 whenever search, filters, or sort change", () => {
    const { result } = renderHook(() => useListState({ defaultSort: "name" }));
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    act(() => result.current.updateSearch("dome"));
    expect(result.current.page).toBe(1);

    act(() => result.current.setPage(4));
    act(() => result.current.updateFilter("status", "Active"));
    expect(result.current.page).toBe(1);
    expect(result.current.filters).toEqual({ status: "Active" });
  });

  it("omits an empty search term from the request params", () => {
    const { result } = renderHook(() => useListState({ defaultSort: "name" }));
    expect(result.current.params.q).toBeUndefined();
    act(() => result.current.updateSearch("ice"));
    expect(result.current.params.q).toBe("ice");
  });
});
