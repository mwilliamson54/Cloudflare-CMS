import { expect, test } from "@playwright/test";

test.describe("authenticated media upload queue", () => {
  test.skip(process.env.CMS_E2E_TEST_AUTH !== "1", "Requires the explicitly opt-in local E2E session.");

  test("keeps a failed file visible and retryable without affecting the library", async ({ page }) => {
    await page.goto("/admin/media");
    await expect(page.getByRole("heading", { name: "Media library" })).toBeVisible();
    await page.locator("input[type='file'][multiple]").setInputFiles({ name: "unsupported.txt", mimeType: "text/plain", buffer: Buffer.from("not an allowed upload") });
    await expect(page.getByText("unsupported.txt", { exact: true })).toBeVisible();
    await expect(page.getByText("Only JPEG, PNG, WebP, AVIF, GIF, and PDF files are allowed.", { exact: true })).toBeVisible();
    await expect(page.getByLabel("unsupported.txt upload progress")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  test("reports completion and persists title and description metadata for an uploaded asset", async ({ page }) => {
    const fileName = `e2e-media-${Date.now()}.png`;
    const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLSDwAAAABJRU5ErkJggg==", "base64");
    await page.goto("/admin/media");
    await page.locator("input[type='file'][multiple]").setInputFiles({ name: fileName, mimeType: "image/png", buffer: image });
    await expect(page.getByText("Uploaded 100%", { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: `Open media ${fileName}` }).click({ timeout: 15_000 });
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Title").fill("E2E editorial asset");
    await page.getByLabel("Description").fill("A temporary image used to verify detailed library metadata editing.");
    await page.getByRole("button", { name: "Save metadata" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("E2E editorial asset", { exact: true })).toBeVisible();
    await page.getByText("E2E editorial asset", { exact: true }).click();
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Remove record" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});
