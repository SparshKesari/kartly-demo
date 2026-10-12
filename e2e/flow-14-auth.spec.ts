import { test, expect, PASSWORD } from "./fixtures";
import { login, openNav } from "./helpers";

test.describe("flow 14: auth errors", () => {
  test("wrong password shows an error that clears on edit", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("demo-accounts")).toBeVisible();
    await page.getByTestId("login-email").fill("alice@kartly.test");
    await page.getByTestId("login-password").fill("WrongPass1");
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("login-error")).toHaveText("Incorrect email or password.");
    await page.getByTestId("login-password").fill("WrongPass12");
    await expect(page.getByTestId("login-error")).toHaveCount(0);

    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("login-error")).toHaveText("Incorrect email or password.");
    await page.getByTestId("login-email").pressSequentially("x");
    await expect(page.getByTestId("login-error")).toHaveCount(0);

    await page.getByTestId("login-email").fill("nobody@kartly.test");
    await page.getByTestId("login-password").fill(PASSWORD);
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("login-error")).toHaveText("Incorrect email or password.");
  });

  test("locked account cannot sign in", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-email").fill("locked@kartly.test");
    await page.getByTestId("login-password").fill(PASSWORD);
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("login-error")).toHaveText("This account is locked.");
    await expect(page.getByTestId("login-link")).toBeVisible();
  });

  test("guest is redirected from /account/orders to login and back", async ({ page }) => {
    await page.goto("/account/orders");
    await expect(page).toHaveURL(/\/login\?next=%2Faccount%2Forders$/);
    await page.getByTestId("login-email").fill("alice@kartly.test");
    await page.getByTestId("login-password").fill(PASSWORD);
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/account\/orders$/);
    await expect(page.getByTestId("account-menu")).toContainText("Hello, Alice");
  });

  test("checkout redirects guests to login", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/login\?next=%2Fcheckout$/);
  });

  test("logout ends the session", async ({ page, request }) => {
    await login(page, "bob@kartly.test");
    await expect(page.getByTestId("account-menu")).toContainText("Hello, Bob Smith");
    await openNav(page);
    await page.getByTestId("logout-btn").click();
    await expect(page.getByTestId("login-link")).toBeVisible();
    await page.goto("/account/orders");
    await expect(page).toHaveURL(/\/login/);
    // the API agrees the session is gone
    const me = await page.request.get("/api/auth/me");
    expect(me.status()).toBe(401);
    expect(request).toBeTruthy();
  });

  test("register validates input and rejects duplicate email", async ({ page }) => {
    await page.goto("/register");
    await page.getByTestId("register-name").fill("Test Person");
    await page.getByTestId("register-email").fill("alice@kartly.test");
    await page.getByTestId("register-password").fill("weakpass");
    await page.getByTestId("register-confirm").fill("weakpass");
    await page.getByTestId("register-submit").click();
    await expect(page.getByTestId("register-error")).toBeVisible();
    await expect(page.getByText("Password must include an uppercase letter.")).toBeVisible();

    await page.getByTestId("register-password").fill("Strong123");
    await page.getByTestId("register-confirm").fill("Strong124");
    await page.getByTestId("register-submit").click();
    await expect(page.getByText("Passwords do not match.")).toBeVisible();

    await page.getByTestId("register-confirm").fill("Strong123");
    await page.getByTestId("register-submit").click();
    await expect(page.getByTestId("register-error")).toHaveText("An account with this email already exists.");

    await page.getByTestId("register-email").fill("new.person@kartly.test");
    await page.getByTestId("register-submit").click();
    await expect(page.getByTestId("account-menu")).toContainText("Hello, Test Person");
  });
});
