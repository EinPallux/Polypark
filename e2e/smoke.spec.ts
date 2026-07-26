import { expect, test } from "@playwright/test";

/**
 * M0 boot smoke (TECHNICAL_ARCHITECTURE §11.3): the shell works end to end —
 * title renders, menu navigates, screens come back. DOM-only assertions; the
 * 3D diorama is decorative and must never be load-bearing for navigation.
 */

test("title screen renders the menu and identity", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Polypark" })).toBeVisible();
  await expect(page.getByTestId("menu-play")).toBeVisible();
  await expect(page.getByTestId("menu-continue")).toBeDisabled();
  await expect(page.getByTestId("menu-options")).toBeVisible();
  await expect(page.getByTestId("menu-extras")).toBeVisible();
  // Decorative canvas mounts (WebGL may be software-rendered — presence only).
  await expect(page.locator("canvas")).toBeAttached();
});

test("play navigates to the hub and ESC returns", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("menu-play").click();
  await expect(page).toHaveURL(/\/hub$/);
  await expect(page.getByRole("heading", { name: "Play" })).toBeVisible();
  await expect(page.getByTestId("card-my-parks")).toBeEnabled(); // live since M1
  await expect(page.getByTestId("card-stories")).toBeDisabled();
  await expect(page.getByTestId("card-collection")).toBeDisabled();
  await expect(page.getByTestId("card-profile")).toBeDisabled();
  await expect(page.getByTestId("hub-new-park")).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/$/);
});

test("keyboard-only: enter activates Play, arrows move focus", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("menu-play")).toBeVisible(); // hydrated & interactive
  // First enabled item (Play) starts focused — Enter goes straight to the hub.
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/hub$/);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("menu-play")).toBeVisible(); // remounted & interactive
  // Arrow down moves focus to Options.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/options$/);
});

test("options tabs switch and controls respond", async ({ page }) => {
  await page.goto("/options");
  await expect(page.getByRole("heading", { name: "Options" })).toBeVisible();
  await page.getByRole("tab", { name: "Audio" }).click();
  const captions = page.getByRole("switch", { name: "Audio captions" });
  await expect(captions).toHaveAttribute("aria-checked", "false");
  await captions.click();
  await expect(captions).toHaveAttribute("aria-checked", "true");
  await page.getByRole("tab", { name: "Accessibility" }).click();
  await expect(page.getByRole("switch", { name: "Readable font" })).toBeVisible();
});

test("extras credits the CC0 creators", async ({ page }) => {
  await page.goto("/extras");
  await expect(page.getByText(/Kenney/)).toBeVisible();
  await expect(page.getByText(/Kay Lousberg/)).toBeVisible();
});

test("uikit gallery renders every component section", async ({ page }) => {
  await page.goto("/dev/uikit");
  for (const section of [
    "display-title",
    "slab-buttons",
    "ribbon-tags",
    "keycaps-and-hints",
    "kit-cards",
    "tab-bar",
    "row-controls",
    "identity-chip",
  ]) {
    await expect(page.getByTestId(`uikit-${section}`)).toBeVisible();
  }
});

test("unknown routes get the friendly 404", async ({ page }) => {
  await page.goto("/definitely-not-a-ride");
  await expect(page.getByText("This path leads nowhere")).toBeVisible();
});
