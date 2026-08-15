import { expect, test } from "@playwright/test";

test.describe("authenticated CMS critical paths", () => {
  test.skip(process.env.CMS_E2E_TEST_AUTH !== "1", "Requires the explicitly opt-in local E2E session.");

  test("publishes an admin-created story and exposes it through the public archive and search", async ({ page }) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const title = `E2E published story ${suffix}`;
    const slug = `e2e-published-story-${suffix}`;
    await page.goto("/admin/posts");
    await page.getByRole("button", { name: "New post" }).click();
    await page.locator("#entry-title").fill(title);
    await page.locator("#entry-slug").fill(slug);
    await page.getByRole("button", { name: "Markdown" }).click();
    await page.locator("#entry-excerpt").fill("A browser-verified editorial publication path.");
    const publicationStatus = page.locator("button[role='combobox']").nth(1);
    await publicationStatus.click();
    await page.getByRole("option", { name: "published", exact: true }).click();
    await page.getByRole("button", { name: "Save published" }).click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();

    await page.goto("/blog");
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await page.goto(`/search?q=${encodeURIComponent(title)}`);
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await page.goto("/");
    await expect(page.getByText(title, { exact: true })).toBeVisible();

    await page.goto("/admin/posts");
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: `Move ${title} to trash` }).click();
    await expect(page.getByText("Content moved to trash. You can restore it from the trash view.", { exact: true })).toBeVisible();
    await page.goto("/blog");
    await expect(page.getByText(title, { exact: true })).toBeHidden();
    await page.goto("/");
    await expect(page.getByText(title, { exact: true })).toBeHidden();
    await page.goto("/admin/posts");
    await page.getByRole("button", { name: "View trash" }).click();
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: `Permanently delete ${title}` }).click();
  });

  test("saves a header menu and reflects it in the public shell before restoring the original configuration", async ({ page }) => {
    const label = `E2E navigation ${Date.now()}`;
    await page.goto("/admin/menus");
    const menuItems = page.locator("textarea");
    await expect(menuItems).not.toHaveValue("", { timeout: 10_000 });
    const original = await menuItems.inputValue();
    try {
      await menuItems.fill(`${label} | /blog`);
      await page.getByRole("button", { name: "Save header menu" }).click();
      await expect(page.getByText("Header navigation is live.", { exact: true })).toBeVisible();
      await page.goto("/");
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    } finally {
      await page.goto("/admin/menus");
      await page.locator("textarea").fill(original);
      await page.getByRole("button", { name: "Save header menu" }).click();
      await expect(page.getByText("Header navigation is live.", { exact: true })).toBeVisible();
    }
  });
});
