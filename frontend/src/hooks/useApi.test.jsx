import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useQuery } from "./useApi";

it("a slower old response cannot overwrite a newly refreshed safety result", async () => {
  let oldResolve, newResolve;
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise((resolve) => { oldResolve = resolve; }))
    .mockImplementationOnce(() => new Promise((resolve) => { newResolve = resolve; }));
  const { result } = renderHook(() => useQuery(fetcher));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  act(() => { result.current.refetch(); });
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  await act(async () => { newResolve({ ready: false }); });
  await act(async () => { oldResolve({ ready: true }); });
  expect(result.current.data).toEqual({ ready: false });
});
