import { test, expect } from "@playwright/test";

const API = "http://127.0.0.1:8001/api";
async function login(page, request) {
  const response = await request.post(`${API}/auth/login`, { data: { email: "admin@polarops.io", password: "admin123" } });
  expect(response.ok()).toBeTruthy();
  const session = await response.json();
  await page.addInitScript((data) => {
    localStorage.setItem("polarops.token", data.token);
    localStorage.setItem("polarops.user", JSON.stringify(data.user));
    sessionStorage.setItem("polarops.theme-discovery", "done");
  }, session);
  return { Authorization: `Bearer ${session.token}` };
}

test("training delay, recovery comparison, durable draft and both themes", async ({ page, request }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const headers = await login(page, request);
  const before = await (await request.get(`${API}/planning/context`, { headers })).json();
  await page.goto("/planning");
  await page.getByRole("button", { name: "Training", exact: true }).click();
  const forecast = page.getByRole("region", { name: "Endurance forecast" });
  await expect(forecast.getByText("4.4 days", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset to baseline" }).click();
  await expect(forecast.getByText("Beyond 14 days", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "72h delay", exact: true }).click();
  await expect(forecast.getByText("4.4 days", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Stock transfer · preview Transfer 500 L of Diesel/ }).click();
  await expect(forecast.getByText("━ With selected transfer", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/planner-frost.png", fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page.screenshot({ path: "test-results/planner-aurora.png", fullPage: true, animations: "disabled" });
  await page.getByLabel("Draft title", { exact: true }).fill("Training 72h recovery review");
  await page.getByLabel("Reason for this recovery plan").fill("Review tractor crew and weather before approving this exercise transfer.");
  await page.getByRole("button", { name: "Save recovery draft" }).click();
  await expect(page.getByRole("tab", { name: "Saved drafts" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: /Training 72h recovery review/ }).click();
  await expect(page.getByRole("region", { name: "Saved draft detail" })).toContainText("Reserve projection: 4.4 days → Beyond 14 days");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download plan" }).click();
  expect((await download).suggestedFilename()).toMatch(/^PLAN-.+\.md$/);
  await page.reload();
  await page.getByRole("tab", { name: "Saved drafts" }).click();
  await expect(page.getByRole("button", { name: /Training 72h recovery review/ })).toBeVisible();
  expect(await (await request.get(`${API}/planning/context`, { headers })).json()).toEqual(before);
  expect(errors).toEqual([]);
});

test("mobile controls remove unavailable recovery options without overflow", async ({ page, request }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page, request);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/planning");
  await page.getByRole("button", { name: "Training", exact: true }).click();
  await expect(page.getByRole("button", { name: /Stock transfer · preview Transfer 500 L of Diesel/ })).toBeVisible();
  await page.getByRole("button", { name: "Route closure", exact: true }).click();
  await expect(page.getByRole("button", { name: /Stock transfer · preview Transfer 500 L of Diesel/ })).toHaveCount(0);
  await expect(page.getByText("Transport link is closed for this scenario.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "72h delay", exact: true }).click();
  await page.getByLabel("Make an asset unavailable").selectOption("haul-1");
  await expect(page.getByText("Supply tractor is unavailable in this scenario.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Stock transfer · preview Transfer 500 L of Diesel/ })).toHaveCount(0);
  await page.getByRole("button", { name: "72h delay", exact: true }).click();
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page.screenshot({ path: "test-results/planner-mobile.png", fullPage: true, animations: "disabled" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.getByRole("tab", { name: "Planning inputs" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
});

test("configure live consumption, arrival and approved link; reject stale review", async ({ page, request }) => {
  const headers = await login(page, request);
  const post = async (path, data) => { const r = await request.post(`${API}${path}`, { headers, data }); expect(r.ok(), await r.text()).toBeTruthy(); return (await r.json()).data; };
  const context = (await (await request.get(`${API}/planning/context`, { headers })).json()).data;
  const [targetStation, donorStation] = context.stations.filter((s) => s.status === "operational");
  const itemName = "Browser endurance fuel";
  const target = await post("/inventory", { name: itemName, category: "fuel", unit: "L", quantity: 260, threshold: 40, station_id: targetStation.id });
  const donor = await post("/inventory", { name: itemName, category: "fuel", unit: "L", quantity: 2200, threshold: 300, station_id: donorStation.id });
  const tractor = await post("/assets", { name: "Browser planning tractor", category: "vehicle", current_holder_type: "station", current_holder_id: donorStation.id });
  await page.goto("/planning");
  await page.getByRole("tab", { name: "Planning inputs" }).click();
  for (const [station, min, max, reserve] of [[targetStation, "40", "50", "40"], [donorStation, "20", "30", "300"]]) {
    await page.getByText(`${itemName} · ${station.name}`, { exact: true }).locator("../..").getByRole("button", { name: "Configure" }).click();
    await page.getByLabel("Minimum daily use (item units)").fill(min);
    await page.getByLabel("Maximum daily use (item units)").fill(max);
    await page.getByLabel("Protected reserve (item units)").fill(reserve);
    await page.getByLabel("Source & assumptions").fill("Browser test measured consumption, fictional station log.");
    await page.getByRole("button", { name: "Save planning input" }).click();
    await expect(page.getByRole("form", { name: "Planning input editor" })).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Add arrival" }).click();
  await page.getByLabel("Inventory item", { exact: true }).selectOption(target.id);
  await page.getByLabel("Incoming quantity (item units)").fill("500");
  await page.getByLabel("Expected arrival (UTC)").fill(new Date(Date.now() + 3.5 * 86400000).toISOString().slice(0, 16));
  await page.getByLabel("Source & assumptions").fill("External delivery from outside current station stocks.");
  await page.getByRole("button", { name: "Save planning input" }).click();
  await expect(page.getByRole("form", { name: "Planning input editor" })).toHaveCount(0);
  await page.getByRole("button", { name: "Add supply link" }).click();
  await page.getByLabel("Source inventory").selectOption(donor.id);
  await page.getByLabel("Destination inventory").selectOption(target.id);
  await page.getByLabel("Approved transport asset").selectOption(tractor.id);
  await page.getByLabel("Declared travel time (hours)").fill("12");
  await page.getByLabel("One-trip capacity (item units)").fill("500");
  await page.getByLabel("Approval reference & operating assumptions").fill("Browser exercise approved surface link and fuel allowance.");
  await page.getByRole("checkbox", { name: /This link is approved/ }).check();
  await page.getByRole("button", { name: "Save planning input" }).click();
  await expect(page.getByRole("form", { name: "Planning input editor" })).toHaveCount(0);
  await page.getByRole("tab", { name: "Scenario lab" }).click();
  await page.getByLabel("Supply to inspect").selectOption(target.id);
  await page.getByRole("slider", { name: "Supply delay hours" }).fill("72");
  await page.getByRole("button", { name: /Stock transfer · preview Transfer 500 L of Browser endurance fuel/ }).click();
  await page.getByLabel("Reason for this recovery plan").fill("Verify forecast against the latest inventory before dispatch.");
  await request.patch(`${API}/inventory/${target.id}`, { headers, data: { quantity: 261 } });
  await page.getByRole("button", { name: "Save recovery draft" }).click();
  await expect(page.getByRole("alert")).toContainText("Planning data changed");
  await page.getByRole("button", { name: "Refresh inputs" }).click();
  await page.getByRole("button", { name: /Stock transfer · preview Transfer 500 L of Browser endurance fuel/ }).click();
  await page.getByLabel("Draft title", { exact: true }).fill("Live browser recovery review");
  await page.getByLabel("Reason for this recovery plan").fill("Updated stock verified; officer to review transport conditions.");
  await page.getByRole("button", { name: "Save recovery draft" }).click();
  await expect(page.getByRole("button", { name: /Live browser recovery review/ })).toBeVisible();
});
