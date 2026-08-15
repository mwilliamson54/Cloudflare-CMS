import { expect, test } from "@playwright/test";

test.describe("authenticated editor authoring modes", () => {
  test.skip(process.env.CMS_E2E_TEST_AUTH !== "1", "Requires the explicitly opt-in local E2E session.");

  test("preserves rich visual/source editing in both directions and contains unsafe previews", async ({ page }) => {
    await page.goto("/admin/posts");
    await expect(page.getByRole("heading", { name: "Stories" })).toBeVisible();
    await page.getByRole("button", { name: "New post" }).click();
    await expect(page.getByText("Compose with intent")).toBeVisible();

    await page.getByRole("button", { name: "Visual" }).click();
    const visualEditor = page.locator("[contenteditable='true']");
    await expect(visualEditor).toBeVisible();
    await visualEditor.fill("Visual editorial copy.");
    await visualEditor.press("Control+A");
    await visualEditor.press("Control+B");

    await page.getByRole("button", { name: "HTML source" }).click();
    const source = page.locator("#entry-html");
    await expect(source).toHaveValue(/<(strong|b)>Visual editorial copy\.<\/(strong|b)>/);
    await source.fill("<p>Source <strong>emphasis</strong>.</p>");
    await page.getByRole("button", { name: "Visual" }).click();
    await expect(visualEditor).toHaveText("Source emphasis.");
    await expect(visualEditor).toHaveJSProperty("innerHTML", "<p>Source <strong>emphasis</strong>.</p>");

    await page.getByRole("button", { name: "HTML source" }).click();
    await source.fill('<p>Unsafe preview</p><script>window.__cmsUnsafePreview = true</script>');
    await page.getByRole("button", { name: "Live preview" }).click();
    await expect(page.locator("iframe[sandbox]")).toBeVisible();
    await expect(page.locator("iframe[sandbox]")).toHaveAttribute("sandbox", "");
    await expect.poll(() => page.evaluate(() => (window as Window & { __cmsUnsafePreview?: boolean }).__cmsUnsafePreview)).toBeUndefined();
  });
});
