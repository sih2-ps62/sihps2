import { describe, expect, it, vi, afterEach } from "vitest";
import { api, getBlackoutState, toggleBlackout, subscribeBlackout } from "./api";

describe("Blackout Mode offline queue", () => {
  it("never queues medical credentials or safety-critical decisions", async () => {
    toggleBlackout();
    for (const path of ["/medical/access", "/auth/login", "/expeditions/EXP-0001", "/emergencies/INC-0001", "/planning/simulate", "/planning/drafts", "/planning/profiles/INV-0001"]) {
      await expect(api.post(path, { password: "sensitive" })).rejects.toThrow("live verification");
    }
    expect(getBlackoutState().queue).toHaveLength(0);
  });
  afterEach(async () => {
    // These are module-level singletons, so leftover state (blackout on, a queued item) would leak into the
    // next test. Give any pending write a fetch mock that actually succeeds, then let it fully drain.
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) })));
    vi.useFakeTimers();
    if (getBlackoutState().active) toggleBlackout();
    await vi.advanceTimersByTimeAsync(2000);
    vi.useRealTimers();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("queues a write instead of sending it while blackout mode is on", async () => {
    toggleBlackout();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await api.post("/personnel/PER-001/checkin", {});

    expect(result.queued).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getBlackoutState().queue).toHaveLength(1);
    expect(getBlackoutState().queue[0].status).toBe("waiting");
  });

  it("reads still pass through live even while blackout mode is on", async () => {
    toggleBlackout();
    const fetchSpy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) }));
    vi.stubGlobal("fetch", fetchSpy);

    await api.get("/stations");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(getBlackoutState().queue).toHaveLength(0);
  });

  it("replays a queued write once blackout mode is turned off, then clears it", async () => {
    toggleBlackout();
    vi.stubGlobal("fetch", vi.fn());
    await api.patch("/inventory/INV-0001", { quantity: 5 });
    expect(getBlackoutState().queue).toHaveLength(1);

    const fetchSpy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
    vi.stubGlobal("fetch", fetchSpy);
    vi.useFakeTimers();

    toggleBlackout(); // turns it off and starts draining
    await vi.advanceTimersByTimeAsync(1000); // past the 800ms post-sync UI delay

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(getBlackoutState().queue).toHaveLength(0);
    expect(getBlackoutState().active).toBe(false);
  });

  it("notifies subscribers with the current queue as it changes", async () => {
    const snapshots = [];
    const unsubscribe = subscribeBlackout((state) => snapshots.push(state));

    toggleBlackout();
    vi.stubGlobal("fetch", vi.fn());
    await api.patch("/inventory/INV-0001", { quantity: 1 });

    expect(snapshots.some((s) => s.active && s.queue.length === 1)).toBe(true);
    unsubscribe();
  });
});
