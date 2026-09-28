import { test, expect } from "@playwright/test";

const API = "http://127.0.0.1:8001/api";
async function session(page, request, medical = false) {
  const response = await request.post(`${API}/auth/login`, { data: { email: medical ? "medic@polarops.io" : "admin@polarops.io", password: medical ? "polarmedic26" : "glacieradmin26" } });
  expect(response.ok()).toBeTruthy();
  const login = await response.json();
  await page.addInitScript((data) => {
    localStorage.setItem("polarops.token", data.token);
    localStorage.setItem("polarops.user", JSON.stringify(data.user));
    sessionStorage.setItem("polarops.theme-discovery", "done");
  }, login);
  return { Authorization: `Bearer ${login.token}` };
}

test("theme invitation timing, Aurora stars, Frost snowflakes and persistence", async ({ page }) => {
  await page.clock.install();
  await page.goto("/login");
  await page.clock.runFor(5900);
  await expect(page.getByLabel("Try another theme")).toHaveCount(0);
  await page.clock.runFor(200);
  await expect(page.getByLabel("Try another theme")).toBeVisible();
  await page.mouse.click(20, 20);
  await expect(page.locator(".click-snow")).toHaveCount(1);
  await page.clock.runFor(2000);
  await expect(page.locator(".click-particle")).toHaveCount(0);
  await page.clock.runFor(17000);
  await expect(page.getByLabel("Try another theme")).toHaveCount(0);
  await page.clock.runFor(155000);
  await expect(page.getByLabel("Try another theme")).toBeVisible();
  await page.getByRole("button", { name: "Try Aurora" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.clock.runFor(2000);
  await page.mouse.click(20, 20);
  await expect(page.locator(".click-star")).toHaveCount(1);
  await page.clock.runFor(2000);
  await expect(page.locator(".click-particle")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.clock.runFor(181000);
  await expect(page.getByLabel("Try another theme")).toHaveCount(0);
});

test("crew manifest, launch, waypoint and route deviation work through the screens", async ({ page, request }) => {
  const headers = await session(page, request);
  const post = async (path, data) => { const response = await request.post(`${API}${path}`, { headers, data }); expect(response.ok(), await response.text()).toBeTruthy(); return (await response.json()).data; };
  const crew = [];
  for (let i = 1; i <= 2; i++) crew.push(await post("/personnel", { name: `Browser crew ${i}`, role: "Field scientist", status: "In Field", station_id: "mcmurdo" }));
  const kit = await post("/assets", { name: "Browser emergency kit", category: "medical", current_holder_type: "station", current_holder_id: "mcmurdo" });
  const mission = await post("/expeditions", { name: "Browser safety traverse", status: "Planned", region: "Antarctic", team_lead: "Browser crew 1", start_date: "2026-12-01", waypoints: ["mcmurdo", "vostok"] });
  await page.goto(`/expeditions/${mission.id}`);
  await expect(page.getByRole("button", { name: "Launch expedition" })).toBeDisabled();
  for (let i = 1; i <= 2; i++) await page.getByRole("checkbox", { name: new RegExp(`Browser crew ${i}`) }).check();
  await page.getByRole("checkbox", { name: /Browser emergency kit/ }).check();
  await page.getByLabel("Emergency kit on manifest").selectOption(kit.id);
  await page.getByRole("button", { name: "Save manifest" }).click();
  await expect(page.getByText("GO · READY TO DEPART", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Launch expedition" }).click();
  await expect(page.getByText("LIVE SAFETY CHECK", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark reached" }).first().click();
  await expect(page.getByText("Reached", { exact: true })).toBeVisible();
  await page.goto(`/personnel/${crew[0].id}`);
  await page.getByLabel("Reported station").selectOption("mcmurdo");
  await page.getByRole("button", { name: "Record check-in", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Route deviation:" })).toBeVisible();
  await page.goto(`/expeditions/${mission.id}`);
  await expect(page.getByLabel("Route deviation alerts")).toBeVisible();
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page.screenshot({ path: "test-results/aurora-expedition.png", fullPage: true, animations: "disabled" });
  await page.getByLabel("Review note for Browser crew 1").fill("Radio confirmed return to departure station");
  await page.getByRole("button", { name: "Mark reviewed" }).click();
  await expect(page.getByLabel("Route deviation alerts")).toHaveCount(0);
});

test("incident resource conflict is shown and medical data stays locked for admin", async ({ page, request }) => {
  const headers = await session(page, request);
  const post = async (path, data) => (await (await request.post(`${API}${path}`, { headers, data })).json()).data;
  const asset = await post("/assets", { name: "Scarce rescue snowmobile", category: "vehicle", current_holder_type: "station", current_holder_id: "mcmurdo" });
  const first = await post("/emergencies", { title: "First rescue", severity: "critical", station_id: "mcmurdo" });
  const second = await post("/emergencies", { title: "Second rescue", severity: "critical", personnel_id: "PER-001" });
  await request.patch(`${API}/emergencies/${first.id}`, { headers, data: { asset_ids: [asset.id] } });
  await page.goto(`/emergency/${second.id}`);
  await expect(page.getByText(/Admin and duty-officer roles do not automatically/)).toBeVisible();
  await page.getByRole("checkbox", { name: /Scarce rescue snowmobile/ }).check();
  await expect(page.getByText("Resource conflict — assignment blocked")).toBeVisible();
  await expect(page.getByRole("button", { name: "Assign response resources" })).toBeDisabled();
});

test("medical registration, incident quick-card and lock-on-blur", async ({ page, request }) => {
  const headers = await session(page, request, true);
  await page.goto("/personnel/PER-002");
  await page.getByLabel("Reason for clinical access").fill("Pre-departure clinical registration");
  await page.getByLabel("Confirm your password").fill("polarmedic26");
  await page.getByRole("button", { name: "Unlock critical information" }).click();
  await page.getByLabel("Blood type", { exact: true }).selectOption("O+");
  await page.getByLabel("Allergies", { exact: true }).fill("Browser test allergy");
  await page.getByLabel("Known conditions", { exact: true }).fill("Not recorded");
  await page.getByRole("button", { name: "Save critical information" }).click();
  await expect(page.getByText(/Last registered:/)).toBeVisible();
  const response = await request.post(`${API}/emergencies`, { headers, data: { title: "Medical browser case", severity: "critical", personnel_id: "PER-002" } });
  const incident = (await response.json()).data;
  await page.goto(`/emergency/${incident.id}`);
  await page.getByLabel("Reason for clinical access").fill("Responding to this person's incident");
  await page.getByLabel("Confirm your password").fill("polarmedic26");
  await page.getByRole("button", { name: "Unlock critical information" }).click();
  await expect(page.getByText("Browser test allergy", { exact: true })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.getByText("Browser test allergy", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Unlock critical information" })).toBeVisible();
});

test("desktop and mobile screens render without overflow or script errors", async ({ page, request }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await session(page, request);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Operations Command" })).toBeVisible();
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page.screenshot({ path: "test-results/aurora-dashboard.png", fullPage: true, animations: "disabled" });
  const styles = await page.locator(".glass-card").first().evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }));
  expect(styles.bg).not.toBe("rgba(0, 0, 0, 0)");
  for (const url of ["/inventory", "/personnel", "/emergency", "/analytics", "/cargo", "/settings"]) {
    await page.goto(url);
    await expect(page.locator("main")).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const url of ["/expeditions/EXP-0002", "/emergency", "/inventory", "/personnel/PER-003"]) {
    await page.goto(url);
    await expect(page.locator("main")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  }
  await page.screenshot({ path: "test-results/aurora-mobile.png", fullPage: true, animations: "disabled" });
  expect(errors).toEqual([]);
});
