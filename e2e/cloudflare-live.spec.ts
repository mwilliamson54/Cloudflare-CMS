import { expect, test } from "@playwright/test";

const liveMode = process.env.CMS_E2E_LIVE_CLOUDFLARE === "1";
const email = process.env.CMS_E2E_LIVE_EMAIL;
const password = process.env.CMS_E2E_LIVE_PASSWORD;

test.describe("Cloudflare live authentication contract", () => {
  test.skip(!liveMode || !email || !password, "Set CMS_E2E_LIVE_CLOUDFLARE=1, CMS_E2E_LIVE_EMAIL, and CMS_E2E_LIVE_PASSWORD to run against a real Pages deployment.");

  test("browser login redirect, failed credentials, successful dashboard, and logout", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login$/);
    await page.locator('input[type="email"]').fill(email!);
    await page.locator('input[type="password"]').fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toContainText(/unable to sign in|invalid credentials/i);
    await page.locator('input[type="password"]').fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByText(email!, { exact: true }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("login, me, logout, and revoked session behavior", async ({ request, baseURL }) => {
    expect(baseURL).toBeTruthy();
    const login = await request.post(`${baseURL}/api/auth/login`, { data: { email, password } });
    expect(login.ok()).toBeTruthy();
    const loginBody = await login.json();
    expect(loginBody.user).toMatchObject({ email });

    const me = await request.get(`${baseURL}/api/auth/me`);
    expect(me.ok()).toBeTruthy();
    expect((await me.json()).user).toMatchObject({ email });

    const state = await request.storageState();
    const csrfToken = state.cookies.find(cookie => cookie.name === "cms_csrf_token")?.value;
    expect(csrfToken).toBeTruthy();
    const logout = await request.post(`${baseURL}/api/auth/logout`, { headers: { "x-csrf-token": csrfToken! } });
    expect(logout.ok()).toBeTruthy();

    const afterLogout = await request.get(`${baseURL}/api/auth/me`);
    expect(afterLogout.status()).toBe(401);
  });
});
