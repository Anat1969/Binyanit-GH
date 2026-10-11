import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const program = JSON.parse(readFileSync("src/data/program.json", "utf8"));
const FALLBACK_STYLE = { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#e9ebe8" } }] };

async function setup(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  // External basemap is not reachable from the test environment: serve a minimal style instead.
  await page.route("**/tiles.openfreemap.org/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FALLBACK_STYLE) }));
  return errors;
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test("program: KPIs, map modes, legend, approximate banner", async ({ page }) => {
  const errors = await setup(page);
  await page.goto("/program");
  const kpis = page.getByTestId("kpis");
  for (const v of ["22,565", "5,000", "7,415", "13,627", "19,005", "462"]) await expect(kpis).toContainText(v);
  await expect(page.getByTestId("approx-banner")).toContainText("גבולות משוערים");
  await expect(page.getByTestId("program-map")).toHaveAttribute("data-state", /ready|error/);

  const modes = page.getByRole("group", { name: "תצוגת המפה" });
  for (const m of ["שנת הקמה", "תוספת יח\"ד", "אחוז אוכלוסייה חרדית", "כושר נשיאה"]) {
    await modes.getByRole("button", { name: m }).click();
    await expect(modes.getByRole("button", { name: m })).toHaveAttribute("aria-pressed", "true");
    if (m === "שנת הקמה") await expect(page.getByTestId("era-empty")).toBeVisible();
  }
  await expect(page.locator(".legend").first()).toContainText("כושר נשיאה חיובי עם יתרה");
  await noHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test("program: 14 rova buttons colored by status, navigate", async ({ page }) => {
  const errors = await setup(page);
  await page.goto("/program");
  const btns = page.getByRole("navigation", { name: "רובעים" }).getByRole("link");
  await expect(btns).toHaveCount(14);
  await expect(page.locator('.rova-btn[data-status="positive"]')).toHaveCount(4); // a, y, ya, yg (group)
  await expect(page.locator('.rova-btn[data-status="none"]')).toHaveCount(1); // ch
  await expect(page.locator('.rova-btn[data-status="null"]')).toHaveCount(4); // mar-tzafon, z, t, tv
  await btns.filter({ hasText: "רובע ג'" }).click();
  await expect(page).toHaveURL(/\/program\/g$/);
  expect(errors).toEqual([]);
});

test("program: comparison table sorts every column, filter, search, CSV", async ({ page }) => {
  const errors = await setup(page);
  await page.goto("/program");
  const table = page.getByTestId("cmp-table");
  const headers = table.locator("thead .sort-btn");
  const n = await headers.count();
  expect(n).toBe(11);
  for (let i = 0; i < n; i++) {
    await headers.nth(i).click();
    await expect(headers.nth(i)).toHaveAttribute("data-sort", "asc");
    await headers.nth(i).click();
    await expect(headers.nth(i)).toHaveAttribute("data-sort", "desc");
  }
  // sort by added units desc: first row is רובע ג' (1,035)
  const added = headers.nth(2);
  await added.click();
  await added.click();
  if ((await added.getAttribute("data-sort")) !== "desc") await added.click();
  await expect(table.locator("tbody tr").first()).toContainText("רובע ג'");

  await page.locator('select[name="status-filter"]').selectOption("negative_with_solution");
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await page.locator('select[name="status-filter"]').selectOption("all");
  await page.locator('input[name="rova-search"]').fill("י\"א");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await page.locator('input[name="rova-search"]').fill("אין כזה");
  await expect(page.getByTestId("table-empty").first()).toBeVisible();
  await page.locator('input[name="rova-search"]').fill("");

  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "ייצוא CSV" }).click();
  const file = await dl;
  expect(file.suggestedFilename()).toBe("program-603-0972307.csv");
  const csv = readFileSync(await file.path(), "utf8");
  expect(csv.startsWith("﻿")).toBe(true);
  expect(csv.split("\r\n")).toHaveLength(15);
  expect(csv).toContain("רובע ג'");
  expect(errors).toEqual([]);
});

test("program: education, unused classes and community tables sort; totals from source", async ({ page }) => {
  const errors = await setup(page);
  await page.goto("/program");
  for (const id of ["edu-table", "unused-table", "com-table"]) {
    const t = page.getByTestId(id);
    const hs = t.locator("thead .sort-btn");
    const n = await hs.count();
    for (let i = 0; i < n; i++) {
      await hs.nth(i).click();
      await expect(hs.nth(i)).toHaveAttribute("data-sort", "asc");
    }
  }
  await expect(page.getByTestId("edu-table").locator("tfoot")).toContainText("462");
  await expect(page.getByTestId("com-table").locator("tfoot")).toContainText("3,436");
  await expect(page.getByTestId("program-summary")).toContainText("מקווה נשים");
  expect(errors).toEqual([]);
});

test("program: documents open in a new tab; source links point to the right PDF page", async ({ page, request }) => {
  await setup(page);
  await page.goto("/program");
  const docs = page.getByTestId("program-docs");
  const open = docs.getByRole("link", { name: "פתיחה" });
  await expect(open).toHaveCount(3);
  for (const a of await open.all()) await expect(a).toHaveAttribute("target", "_blank");
  await expect(docs).toContainText("הקובץ טרם הועלה"); // forum deck: no file in the source

  for (const path of ["/docs/program-appendix.pdf", "/docs/public-meeting-2026-08-19.pdf"]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    expect(res.headers()["content-type"]).toContain("pdf");
  }
  const links = page.locator("a.src-link");
  const hrefs = await links.evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  expect(hrefs.length).toBeGreaterThan(10);
  for (const h of hrefs) expect(h).toMatch(/^\/docs\/program-appendix\.pdf#page=(1|3|4|5|14|15|16)$/);
  await expect(page.locator('a.src-link[data-page="16"]').first()).toHaveAttribute("target", "_blank");
});

test("rova page: capacity card, flags verbatim, tables sortable, prev/next", async ({ page }) => {
  const errors = await setup(page);
  const g = program.rovaim.find((r: { id: string }) => r.id === "g");
  await page.goto("/program/g");
  await expect(page.locator("h1")).toHaveText("רובע ג'");
  await expect(page.getByTestId("rova-summary")).toHaveText(g.summary);
  const card = page.getByTestId("capacity-card");
  for (const v of ["51", "20", "-31", "400"]) await expect(card).toContainText(v);
  await expect(card).toContainText(g.carrying_capacity.proposed_solution);
  const flags = page.getByTestId("data-flags");
  await expect(flags).toContainText("פערים בנתוני המקור");
  for (const f of g.data_flags) await expect(flags).toContainText(f);
  await expect(page.getByTestId("demand-table")).toContainText("חרדי בנים");
  await expect(page.locator('a.src-link[data-page="8"]').first()).toHaveAttribute("href", "/docs/program-appendix.pdf#page=8");

  for (const t of await page.locator("[data-testid$='-table']").all()) {
    const h = t.locator("thead .sort-btn").first();
    await h.click();
    await expect(h).toHaveAttribute("data-sort", "asc");
  }
  await page.getByTestId("next").click();
  await expect(page).toHaveURL(/\/program\/d$/);
  await page.getByTestId("prev").click();
  await expect(page).toHaveURL(/\/program\/g$/);
  expect(errors).toEqual([]);
});

test("rova pages: every rova renders; group block, low-addition empty state, slide page links", async ({ page }) => {
  const errors = await setup(page);
  const slide: Record<string, number> = { a: 6, b: 7, g: 8, d: 9, h: 10, v: 11, ch: 12, y: 13, ya: 13, yg: 13 };
  for (const r of program.rovaim as { id: string; name: string; added_max_5y: number; group?: string }[]) {
    await page.goto(`/program/${r.id}`);
    await expect(page.locator("h1")).toHaveText(r.name);
    if (r.group) await expect(page.getByTestId("group-block")).toContainText("רובעים י' + י\"א + י\"ג");
    if (r.added_max_5y < 50) await expect(page.getByTestId("low-empty")).toBeVisible();
    if (slide[r.id]) await expect(page.getByRole("link", { name: `פתח בעמוד ${slide[r.id]} של הנספח` })).toHaveAttribute("href", `/docs/program-appendix.pdf#page=${slide[r.id]}`);
    await noHorizontalScroll(page);
  }
  expect((await page.request.get("/program/nope")).status()).toBe(404);
  expect(errors).toEqual([]);
});

test("375px: RTL layout without horizontal scroll on /program and a rova page", async ({ page }) => {
  const errors = await setup(page);
  await page.setViewportSize({ width: 375, height: 812 });
  for (const p of ["/program", "/program/g", "/program/y"]) {
    await page.goto(p);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).direction)).toBe("rtl");
    await noHorizontalScroll(page);
  }
  expect(errors).toEqual([]);
});
