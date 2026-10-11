import { expect, test } from "@playwright/test";

test("traffic: layers load, legend toggles, only-this, zoom, gush search, no errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/traffic");
  await expect(page.locator("h1")).toContainText("איזה רחוב");
  const map = page.getByTestId("traffic-map");
  await expect(map).toHaveAttribute("data-state", "ready");
  await expect(page.locator('[data-layer="active"] path')).not.toHaveCount(0);
  await expect(page.locator('[data-layer="cadastre"] path')).not.toHaveCount(0);

  const legend = page.getByRole("complementary", { name: "מקרא ושכבות" });
  const active = legend.getByRole("checkbox", { name: /רחוב עם חזית פעילה/ });
  await active.uncheck();
  await expect(page.locator('[data-layer="active"]')).toBeHidden();
  await active.check();
  await expect(page.locator('[data-layer="active"]')).toBeVisible();

  await legend.getByRole("button", { name: "הצגת רחוב מקומי מוצע בלבד" }).click();
  await expect(legend.getByRole("checkbox", { name: /רחוב מקומי מוצע/ })).toBeChecked();
  await expect(active).not.toBeChecked();
  await expect(legend.getByRole("checkbox", { name: /גבול התכנית/ })).toBeChecked();
  await legend.getByRole("button", { name: "הצגת הכל" }).first().click();
  await expect(active).toBeChecked();

  const tools = page.getByRole("group", { name: "תצוגת המפה" });
  await tools.getByRole("button", { name: "הגדלה" }).click();
  await expect(page.getByTestId("traffic-zoom")).toHaveText("×1.6");
  await tools.getByRole("button", { name: "הקטנה" }).click();
  await tools.getByRole("button", { name: "כל הגיליון" }).click();
  await expect(page.getByTestId("traffic-zoom")).toHaveText("×1.0");

  await page.getByLabel("איתור גוש לפי מספר").fill("9999");
  await page.getByRole("button", { name: "איתור", exact: true }).click();
  await expect(page.getByTestId("gush-msg")).toContainText("לא מופיע");
  await page.getByLabel("איתור גוש לפי מספר").fill("2018");
  await page.getByLabel("איתור גוש לפי מספר").press("Enter");
  await expect(page.getByTestId("gush-msg")).toContainText("2018");
  await expect(page.getByTestId("traffic-zoom")).toHaveText("×4.0");

  await page.getByRole("link", { name: "לבדיקת כתובת" }).click();
  await expect(page).toHaveURL(/\/check$/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("traffic: clear error state when layers fail", async ({ page }) => {
  await page.route("**/data/traffic/layers.json", (r) => r.fulfill({ status: 500, body: "" }));
  await page.goto("/traffic");
  await expect(page.getByTestId("traffic-map")).toHaveAttribute("data-state", "error");
  await expect(page.getByRole("status")).toContainText("לא נטענו");
});
