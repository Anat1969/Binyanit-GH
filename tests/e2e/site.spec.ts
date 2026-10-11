import { expect, test, type Page } from "@playwright/test";

const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

const LOOKUP_IN = {
  loaded: ["plan_boundary", "street_class", "quarter"],
  in_plan: true,
  street_class: "activeFrontage",
  public_allocation_zone: null,
  urban_renewal_search_zone: null,
  well_radius: null,
  quarter: "ג",
  quarter_quota: { threshold: 400, used: null },
};

async function mockBase(page: Page, opts: { llm?: boolean } = {}) {
  await page.route("**/basemaps.cartocdn.com/**", (r) => r.abort());
  await page.route("**/api/status", (r) => r.fulfill(json({ llm: Boolean(opts.llm) })));
  await page.route("**/api/quarters", (r) => r.fulfill(json([{ quarter: "ח", threshold: 100, units_used: 100 }])));
  await page.route("**/api/layers/**", (r) => r.fulfill(json({ type: "FeatureCollection", features: [] })));
}

async function fillBuilding(page: Page) {
  await page.locator('input[name="existingFloors"]').fill("4");
  await page.locator('input[name="existingUnits"]').fill("16");
  await page.locator('input[name="typicalFloorArea"]').fill("400");
  await page.locator('input[name="plotArea"]').fill("2000");
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test("home: facts, CTAs and navigation", async ({ page }) => {
  await mockBase(page);
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("התחדשות בניינית");
  await expect(page.getByLabel("נתוני התכנית")).toContainText("603-0972307");
  await expect(page.getByLabel("נתוני התכנית")).toContainText("5 שנים");
  await expect(page.locator("main")).toContainText("7.2.1");
  await noHorizontalScroll(page);

  await page.locator("main").getByRole("link", { name: "בדיקת כתובת" }).click();
  await expect(page).toHaveURL(/\/check$/);
  await page.goto("/");
  await page.locator("main").getByRole("link", { name: "שאלה על התכנית" }).click();
  await expect(page).toHaveURL(/\/qa$/);

  for (const [name, path] of [
    ["התכנית", "/plan/603-0972307"],
    ["מסמכים", "/documents"],
    ["מכסות ברובעים", "/quarters"],
    ["שאלות על התכנית", "/qa"],
    ["בדיקת כתובת", "/check"],
    ["ראשי", "/"],
  ] as const) {
    await page.getByRole("navigation", { name: "ניווט ראשי" }).getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path === "/" ? "/$" : path + "$"}`));
    await expect(page.getByRole("navigation", { name: "ניווט ראשי" }).getByRole("link", { name, exact: true })).toHaveAttribute("aria-current", "page");
  }
});

test("check: full flow – geocode, lookup, compute, explain, PDF, anonymous log", async ({ page }) => {
  await mockBase(page, { llm: true });
  await page.route("**/api/geocode**", (r) =>
    r.fulfill(json({ results: [
      { label: "שבטי ישראל 10, אשדוד", lat: 31.8, lon: 34.65 },
      { label: "שבטי ישראל 10, רובע ג, אשדוד", lat: 31.801, lon: 34.651 },
    ] })),
  );
  let lookupUrl = "";
  await page.route("**/api/lookup**", (r) => { lookupUrl = r.request().url(); return r.fulfill(json(LOOKUP_IN)); });
  let checkBody: Record<string, unknown> | null = null;
  await page.route("**/api/checks", (r) => { checkBody = r.request().postDataJSON(); return r.fulfill(json({ ok: true })); });
  let explainBody: { routes?: unknown[] } | null = null;
  await page.route("**/api/explain", (r) => { explainBody = r.request().postDataJSON(); return r.fulfill(json({ available: true, text: "הסבר לדוגמה (4.1.2)." })); });

  await page.goto("/check");
  await page.getByLabel("כתובת").fill("שבטי ישראל 10");
  await page.getByRole("button", { name: "איתור" }).click();
  await page.getByLabel("תוצאות חיפוש").getByRole("button").first().click();
  expect(lookupUrl).toContain("lat=31.8");

  const panel = page.getByTestId("site-panel");
  await expect(panel).toContainText("רחוב עם חזית פעילה");
  await expect(panel).toContainText("מהתשריט");
  await expect(panel).toContainText("ג");

  // empty submit -> validation errors
  await page.getByRole("button", { name: "חישוב פוטנציאל" }).click();
  await expect(page.getByTestId("form-errors")).toBeVisible();

  await fillBuilding(page);
  // toggle every segmented control once and back
  for (const [group, a, b] of [
    ["קומת קרקע", "בנויה (50% ומעלה)", "קומת עמודים"],
    ["טעון חיזוק לרעידות אדמה", "לא", "כן"],
    ["מרחבים מוגנים", "חלקי (עד 50%)", "אין"],
    ["שימוש", "אחר", "מגורים"],
  ] as const) {
    const g = page.getByRole("group", { name: group });
    await g.getByRole("button", { name: a }).click();
    await expect(g.getByRole("button", { name: a })).toHaveAttribute("aria-pressed", "true");
    await g.getByRole("button", { name: b }).click();
  }
  await page.getByText("פרטי פרויקט וחריגים").click();
  await page.getByLabel("הפרויקט כולל שימושים פעילים בקומת הקרקע").check();

  await page.getByRole("button", { name: "חישוב פוטנציאל" }).click();
  const results = page.getByTestId("results");
  await expect(results).toBeVisible();
  await expect(results).toContainText("7.2.1");

  // protection: active street, pilotis -> 1 full floor + partial roof
  await expect(page.getByTestId("route-protection")).toContainText("קומה מלאה אחת וקומת גג חלקית (70%)");
  // retrofit: active street + active ground uses -> 3 full floors + partial roof
  await expect(page.getByTestId("route-retrofit")).toContainText("3 קומות מלאות וקומת גג חלקית (70%)");
  // demolish: 4 floors on an active street -> +7, max 15, coverage 70%
  const demolish = page.getByTestId("route-demolish");
  await expect(demolish).toContainText("+7");
  await expect(demolish).toContainText("15");
  await expect(demolish).toContainText("70%");
  await expect(demolish).toContainText("5,940"); // 540 x 11
  await expect(page.locator("[data-testid^=route-] svg")).toHaveCount(3);

  // notes toggle
  await demolish.getByText(/הערות/).click();
  await expect(demolish).toContainText("20%");

  expect(checkBody).not.toBeNull();
  expect(JSON.stringify(checkBody)).not.toContain("שבטי");
  expect(checkBody!.eligible_routes).toEqual(["protection", "retrofit", "demolish"]);

  await page.getByRole("button", { name: "הסבר מורחב" }).click();
  await expect(page.getByTestId("explain")).toContainText("הסבר לדוגמה");
  expect(explainBody!.routes).toHaveLength(3);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "הורדת קובץ פוטנציאל (PDF)" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^potential-603-0972307-\d+\.pdf$/);

  await noHorizontalScroll(page);
});

test("check: out-of-plan state disables compute", async ({ page }) => {
  await mockBase(page);
  await page.route("**/api/geocode**", (r) => r.fulfill(json({ results: [{ label: "רחוב מחוץ לתכנית 1, אשדוד", lat: 31.77, lon: 34.63 }] })));
  await page.route("**/api/lookup**", (r) => r.fulfill(json({ ...LOOKUP_IN, in_plan: false, quarter: null, quarter_quota: null })));
  await page.goto("/check");
  await page.getByLabel("כתובת").fill("רחוב מחוץ לתכנית 1");
  await page.getByRole("button", { name: "איתור" }).click();
  await expect(page.getByTestId("out-of-plan")).toBeVisible();
  await expect(page.getByRole("button", { name: "חישוב פוטנציאל" })).toBeDisabled();
});

test("check: geocode error, empty result, lookup error and manual mode", async ({ page }) => {
  await mockBase(page);
  let mode: "error" | "empty" = "error";
  await page.route("**/api/geocode**", (r) =>
    mode === "error" ? r.fulfill(json({ error: "שירות האיתור אינו זמין כרגע." }, 502)) : r.fulfill(json({ results: [] })),
  );
  await page.goto("/check");
  await page.getByLabel("כתובת").fill("x");
  await page.getByRole("button", { name: "איתור" }).click();
  await expect(page.locator(".state[role=alert]")).toContainText("רחוב ומספר");
  await page.getByLabel("כתובת").fill("כתובת כלשהי");
  await page.getByRole("button", { name: "איתור" }).click();
  await expect(page.locator(".state[role=alert]")).toContainText("שירות האיתור אינו זמין");
  mode = "empty";
  await page.getByRole("button", { name: "איתור" }).click();
  await expect(page.getByText("הכתובת לא נמצאה")).toBeVisible();

  await page.getByRole("button", { name: "המשך ללא כתובת" }).click();
  const panel = page.getByTestId("site-panel");
  await expect(panel).toContainText("גבול התכנית טרם אומת");
  await panel.getByLabel("סיווג רחוב").selectOption("massTransit");
  await panel.getByLabel("רובע").selectOption("ח");
  await fillBuilding(page);
  await page.getByRole("button", { name: "חישוב פוטנציאל" }).click();
  // quarter Het quota (100/100 in the mocked counters) is exhausted -> routes adding units blocked
  await expect(page.getByTestId("route-demolish")).toContainText("מוצתה");
  await expect(page.getByTestId("route-demolish")).toContainText("לא זמין");

  // lookup error state
  await page.route("**/api/lookup**", (r) => r.fulfill(json({ error: "x" }, 502)));
  mode = "error";
  await page.unroute("**/api/geocode**");
  await page.route("**/api/geocode**", (r) => r.fulfill(json({ results: [{ label: "א", lat: 31.8, lon: 34.65 }] })));
  await page.getByRole("button", { name: "איתור" }).click();
  await expect(page.getByText("הבדיקה המרחבית אינה זמינה כרגע")).toBeVisible();
});

test("check: exclusions block every route", async ({ page }) => {
  await mockBase(page);
  await page.goto("/check");
  await page.getByRole("button", { name: "המשך ללא כתובת" }).click();
  await fillBuilding(page);
  await page.getByText("פרטי פרויקט וחריגים").click();
  for (const label of ["המבנה מיועד להריסה", "חלה תכנית פינוי-בינוי מאושרת", 'בקשה בהליך לפי תמ"א 38 (הוראות מעבר)']) {
    await page.getByLabel(label).check();
    await page.getByRole("button", { name: "חישוב פוטנציאל" }).click();
    await expect(page.getByText("התכנית אינה מאפשרת התחדשות במגרש זה")).toBeVisible();
    await expect(page.locator(".chip.ok", { hasText: "זכאי לבחינה" })).toHaveCount(0);
    await page.getByLabel(label).uncheck();
  }
  await page.getByLabel("הפרויקט כולל אגף חדש").check();
  await page.getByLabel("מבני ציבור בפרויקט הריסה ובנייה").selectOption("kindergarten2");
  await page.getByRole("button", { name: "חישוב פוטנציאל" }).click();
  await expect(page.getByTestId("route-demolish")).toContainText("+7");
});

test("qa: examples, answer with citations, refusal, not found, error", async ({ page }) => {
  await mockBase(page);
  await page.route("**/api/qa", async (r) => {
    const q = r.request().postDataJSON().question as string;
    if (q.includes("שלי")) return r.fulfill(json({ kind: "refused", answer: "הסוכן אינו מחשב זכויות לבניין מסוים.", citations: [], mode: "retrieval" }));
    if (q.includes("פריז")) return r.fulfill(json({ kind: "not_found", answer: "לא נמצא מענה בהוראות התכנית שנטענו למערכת.", citations: [], mode: "retrieval" }));
    if (q.includes("שגיאה")) return r.fulfill(json({ error: "שגיאת שרת" }, 500));
    return r.fulfill(json({ kind: "answer", answer: "להלן הסעיפים הרלוונטיים:", citations: [{ section: "4.1.2", title: "הקצאה לצרכי ציבור", text: "30% משטח קומת הקרקע" }], mode: "retrieval", corpus: "נוסח עבודה" }));
  });
  await page.goto("/qa");
  await expect(page.getByTestId("qa-empty")).toBeVisible();
  await page.getByRole("button", { name: "מתי יש פטור מהקצאה לצרכי ציבור?" }).click();
  await expect(page.getByTestId("qa-answer").last()).toContainText("4.1.2");
  await expect(page.getByTestId("qa-answer").last()).toContainText("30%");

  const box = page.locator('textarea[name="question"]');
  await box.fill("כמה קומות אפשר להוסיף לבניין שלי?");
  await page.getByRole("button", { name: "שליחה" }).click();
  await expect(page.getByText("הסוכן אינו מחשב זכויות").first()).toBeVisible();
  await page.getByRole("link", { name: "למעבר לבדיקת כתובת" }).click();
  await expect(page).toHaveURL(/\/check$/);
  await page.goBack();

  await box.fill("מזג אוויר בפריז");
  await box.press("Enter");
  await expect(page.getByText("לא נמצא מענה").last()).toBeVisible();

  await box.fill("שגיאה בבקשה");
  await page.getByRole("button", { name: "שליחה" }).click();
  await expect(page.getByText("לא התקבלה תשובה")).toBeVisible();
  await noHorizontalScroll(page);
});

test("documents and quarters render a clear state", async ({ page }) => {
  await page.goto("/documents");
  await expect(page.locator("h1")).toContainText("מסמכי התכנית");
  await expect(page.locator(".state, .doc").first()).toBeVisible();
  await noHorizontalScroll(page);
  await page.goto("/quarters");
  await expect(page.locator("h1")).toContainText("יחידות דיור ברובעים");
  await expect(page.locator(".state, .card").first()).toBeVisible();
  await noHorizontalScroll(page);
});

test("plan story page: chapters, facts, sources and CTA", async ({ page }) => {
  await mockBase(page);
  await page.goto("/plan");
  await expect(page).toHaveURL(/\/plan\/603-0972307$/);
  await expect(page.locator("h1")).toContainText("התחדשות בניין אחר בניין");
  await expect(page.locator(".chapter")).toHaveCount(7);
  await expect(page.locator(".fact").first()).toBeVisible();
  await expect(page.getByText("לפי דיווח").first()).toBeVisible();
  await page.getByRole("navigation", { name: "פרקים" }).getByRole("link", { name: "הרחוב קובע" }).click();
  await expect(page).toHaveURL(/#street$/);
  await expect(page.locator("#street")).toBeInViewport();
  await page.getByRole("navigation", { name: "פרקים" }).getByRole("link", { name: "בדיקת כתובת" }).click();
  await expect(page).toHaveURL(/\/check$/);
  await page.goto("/plan/603-0972307");
  await noHorizontalScroll(page);
  expect((await page.request.get("/plan/123")).status()).toBe(404);
});

test("app icon and manifest are served", async ({ page }) => {
  await page.goto("/");
  const icons = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]').evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  expect(icons.some((h) => h?.includes("icon"))).toBe(true);
  expect(icons.some((h) => h?.includes("apple-icon"))).toBe(true);
  expect(icons.some((h) => h?.includes("manifest"))).toBe(true);
  for (const path of ["/icon.svg", "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"]) {
    expect((await page.request.get(path)).status(), path).toBe(200);
  }
  const m = await (await page.request.get("/manifest.webmanifest")).json();
  expect(m.dir).toBe("rtl");
  expect(m.icons).toHaveLength(3);
});

test("documents: open editing without a code, rename, reclassify, remove, add several files", async ({ page }) => {
  await mockBase(page);
  const calls: { method: string; body?: unknown; url: string }[] = [];
  await page.route("**/api/docs**", (r) => {
    const req = r.request();
    calls.push({ method: req.method(), body: req.method() === "POST" ? req.postDataJSON() : undefined, url: req.url() });
    return r.fulfill(json({ ok: true, id: "00000000-0000-0000-0000-000000000001" }));
  });

  await page.goto("/documents");
  await expect(page.getByText("קוד עריכה")).toHaveCount(0);
  const card = page.locator("article.doc").first();
  await card.getByRole("button", { name: "עריכה" }).click();
  const ed = card.getByTestId("doc-editor");
  await ed.getByLabel("שם המסמך").fill("הוראות התכנית המאושרות");
  await ed.getByLabel("סיווג").selectOption("binding");
  await ed.getByRole("button", { name: "שמירה" }).click();
  await expect.poll(() => calls.filter((c) => c.method === "POST").length).toBe(1);
  const body = calls.find((c) => c.method === "POST")!.body as { title: string; category: string };
  expect(body.title).toBe("הוראות התכנית המאושרות");
  expect(body.category).toBe("binding");

  await card.getByRole("button", { name: "עריכה" }).click();
  page.once("dialog", (d) => d.accept());
  await card.getByRole("button", { name: "הסרת המסמך" }).click();
  await expect.poll(() => calls.filter((c) => c.method === "DELETE").length).toBe(1);

  const up = page.getByTestId("upload-form");
  await up.locator('input[type="file"]').setInputFiles([
    { name: "תשריט_גיליון_1.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") },
    { name: "נספח.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") },
  ]);
  await expect(page.getByTestId("pending-doc")).toHaveCount(2);
  await expect(page.getByTestId("pending-doc").first().getByLabel("שם המסמך באתר")).toHaveValue("תשריט גיליון 1");
  await expect(up.getByRole("button", { name: "העלאת 2 המסמכים" })).toBeVisible();
  await page.getByTestId("pending-doc").first().getByRole("button", { name: "ביטול" }).click();
  await expect(up.getByRole("button", { name: "העלאת המסמך" })).toBeVisible();
  await noHorizontalScroll(page);
});

test("qa page shows the plan text section with a clear state", async ({ page }) => {
  await mockBase(page);
  await page.goto("/qa");
  await expect(page.getByTestId("plan-text")).toBeVisible();
  await expect(page.getByTestId("plan-text").locator(".state").first()).toBeVisible();
  await expect(page.getByText("אין להזין פרטים אישיים")).toBeVisible();
});
