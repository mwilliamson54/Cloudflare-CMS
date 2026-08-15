import { expect, test } from "@playwright/test";

test.describe("authenticated graphical editor", () => {
  test.skip(process.env.CMS_E2E_TEST_AUTH !== "1", "Requires the explicitly opt-in local E2E session.");

  test("adds graphical heading, list, table, safe embed, and widget blocks with a rendered preview", async ({ page }) => {
    await page.goto("/admin/posts");
    await page.getByRole("button", { name: "New post" }).click();
    await page.getByRole("button", { name: "Graphical blocks" }).click();
    await expect(page.getByTestId("graphical-editor")).toBeVisible();

    await page.getByRole("button", { name: "Heading" }).click();
    await page.getByLabel("Heading level").last().selectOption("3");
    await page.getByLabel("Heading text").last().fill("Graphical editorial heading");
    await page.getByRole("button", { name: "List" }).click();
    await page.getByLabel("List item 1").last().fill("A graphical list item");
    await page.getByRole("button", { name: "Table" }).click();
    await page.getByLabel("Table heading 1").last().fill("Fabric");
    await page.getByRole("button", { name: "Embed" }).click();
    await page.getByLabel("Embed URL").last().fill("https://www.youtube-nocookie.com/embed/abc");
    await page.getByLabel("Embed title").last().fill("Studio film");
    await page.getByRole("button", { name: "Widget" }).click();
    await page.getByLabel("Widget title").last().fill("Editor’s note");

    await page.getByRole("button", { name: "Live preview" }).click();
    await expect(page.getByRole("heading", { name: "Graphical editorial heading" })).toBeVisible();
    await expect(page.locator("iframe[title='Studio film']")).toHaveAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation");
    await expect(page.getByText("Editor’s note", { exact: true })).toBeVisible();
  });

  test("uploads an R2 image from a graphical block and persists its accessible metadata", async ({ page }) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const title = `Graphical media ${suffix}`;
    const slug = `graphical-media-${suffix}`;
    const fileName = `graphical-${suffix}.png`;
    const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLSDwAAAABJRU5ErkJggg==", "base64");

    await page.goto("/admin/posts");
    await page.getByRole("button", { name: "New post" }).click();
    await page.locator("#entry-title").fill(title);
    await page.locator("#entry-slug").fill(slug);
    await page.getByRole("button", { name: "Graphical blocks" }).click();
    await page.getByRole("button", { name: "Image" }).click();
    await page.getByTestId("graphical-editor").locator("input[type='file']").setInputFiles({ name: fileName, mimeType: "image/png", buffer: image });
    await expect(page.getByText(`${fileName} was uploaded to the R2 media library and inserted.`, { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("Image alternative text").last().fill("A verified graphical editor image");
    await page.getByLabel("Image caption").last().fill("R2-backed graphical image caption");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: `Edit ${title}` }).click();
    await page.getByRole("button", { name: "Graphical blocks" }).click();
    await expect(page.getByLabel("Image alternative text").last()).toHaveValue("A verified graphical editor image");
    await expect(page.getByLabel("Image caption").last()).toHaveValue("R2-backed graphical image caption");

    await page.goto("/admin/posts");
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: `Move ${title} to trash` }).click();
    await expect(page.getByText("Content moved to trash. You can restore it from the trash view.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "View trash" }).click();
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: `Permanently delete ${title}` }).click();
  });
});
