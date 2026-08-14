import { expect, test } from "@playwright/test";

test("public homepage renders the editorial shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("ATELIER JOURNAL").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /studio/i })).toBeVisible();
});

test("anonymous preview routes do not reveal protected entry content", async ({ page }) => {
  await page.goto("/preview/999999");
  await page.waitForURL(/manus\.im\/app-auth/);
  expect(page.url()).toContain("manus.im/app-auth");
});
