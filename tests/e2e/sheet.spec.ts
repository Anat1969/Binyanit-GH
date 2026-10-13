import { expect, test, type Page } from "@playwright/test";

async function setup(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/sheet");
  await expect(page.getByTestId("sheet")).toHaveAttribute("data-state", "ready");
  return errors;
}

/** Screen point inside the first renewal zone (sampled on its bounding box). */
async function renewalPoint(page: Page) {
  return page.evaluate(() => {
    const z = document.querySelector<SVGGeometryElement>(".zone-hit")!;
    const b = z.getBBox();
    const svg = z.ownerSVGElement!;
    const pt = svg.createSVGPoint();
    for (let i = 1; i < 20; i++)
      for (let j = 1; j < 20; j++) {
        pt.x = b.x + (b.width * i) / 20;
        pt.y = b.y + (b.height * j) / 20;
        if (z.isPointInFill(pt)) {
          const s = pt.matrixTransform(z.getScreenCTM()!);
          return { x: s.x, y: s.y };
        }
      }
    return null;
  });
}

test("sheet: layers load, toggle and persist", async ({ page }) => {
  const errors = await setup(page);
  const legend = page.getByRole("complementary", { name: "מקרא ושכבות" });
  await expect(legend).toContainText("31 תחומים");
  await expect(legend).toContainText("ממתין לנתונים");
  const active = page.getByLabel("חזית פעילה");
  await expect(active).toBeChecked();
  await active.uncheck();
  await page.reload();
  await expect(page.getByTestId("sheet")).toHaveAttribute("data-state", "ready");
  await expect(page.getByLabel("חזית פעילה")).not.toBeChecked();
  await page.getByLabel("חזית פעילה").check();
  expect(errors).toEqual([]);
});

test("sheet: background, zoom and table from config", async ({ page }) => {
  const errors = await setup(page);
  const bg = page.getByRole("group", { name: "רקע" });
  for (const b of ["גיליון מקורי", "ללא", "גושים וחלקות"]) {
    await bg.getByRole("button", { name: b }).click();
    await expect(bg.getByRole("button", { name: b })).toHaveAttribute("aria-pressed", "true");
  }
  await page.getByRole("button", { name: "כל הגיליון" }).click();
  await expect(page.locator(".sheet-scale")).toContainText("×1.0");
  await page.getByRole("button", { name: "הגדלה" }).click();
  await expect(page.locator(".sheet-scale")).toContainText("×1.4");
  await page.getByRole("button", { name: "הקטנה" }).click();
  await expect(page.locator(".sheet-scale")).toContainText("×1.0");
  await expect(page.locator(".sheet-tbl")).toContainText("+4 / +5 / +6");
  await expect(page.locator(".sheet-tbl")).toContainText("+5 / +6 / +7");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("sheet: probe inside a renewal zone and outside the plan", async ({ page }) => {
  const errors = await setup(page);
  const p = await renewalPoint(page);
  expect(p).not.toBeNull();
  await page.mouse.click(p!.x, p!.y);
  const probe = page.getByTestId("sheet-probe");
  await expect(probe).toContainText("תחום לאיתור מתחמים להתחדשות עירונית");
  await expect(page.locator(".zone-hit.sel")).toHaveCount(1);

  // Top-left corner of the full sheet is outside the plan boundary.
  await page.getByRole("button", { name: "כל הגיליון" }).click();
  const box = (await page.locator(".sheet-map svg").boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + 12);
  await expect(probe).toContainText("מחוץ לגבול התכנית");
  expect(errors).toEqual([]);
});
