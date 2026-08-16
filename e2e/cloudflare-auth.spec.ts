import { expect, test } from "@playwright/test";

test.describe("Cloudflare production auth UX", () => {
  test.skip(process.env.CMS_E2E_CLOUDFLARE !== "1", "Requires the explicitly opt-in Cloudflare auth browser mode.");

  test("redirects unauthenticated users, shows failed credentials, then signs in and logs out", async ({ page }) => {
    let authenticated = false;
    await page.route("**/api/auth/me", async route => { await route.fulfill({ status: authenticated ? 200 : 401, contentType: "application/json", body: authenticated ? JSON.stringify({ user: { id: 1, email: "admin@example.com", name: "Admin", role: "admin" } }) : JSON.stringify({ error: "Authentication required." }) }); });
    await page.route("**/api/auth/login", async route => { const body = JSON.parse(route.request().postData() || "{}"); if (body.password !== "correct horse battery staple") { await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Invalid credentials." }) }); return; } authenticated = true; await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: 1, email: body.email, name: "Admin", role: "admin" } }) }); });
    await page.route("**/api/auth/logout", async route => { authenticated = false; await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) }); });

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/login");
    const email = page.locator('input[type="email"]');
    const password = page.locator('input[type="password"]');
    await email.fill("admin@example.com");
    await password.fill("wrong password");
    await expect(email).toHaveValue("admin@example.com");
    await expect(password).toHaveValue("wrong password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toHaveText("Invalid credentials.");
    await email.fill("admin@example.com");
    await password.fill("correct horse battery staple");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByText("admin@example.com", { exact: true }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
