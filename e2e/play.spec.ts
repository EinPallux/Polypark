import { expect, test, type Page } from "@playwright/test";

/**
 * M1 Valley smoke: boot a fresh park, build with real UI input, verify money
 * reacts, save through the pause menu, and confirm the continue route restores
 * the exact state (TECH §11.3). DOM assertions only — money is the oracle.
 *
 * Canvas coordinates assume this fixed viewport (the meadow center sits around
 * y≈500 at 1600×900; smaller viewports would aim south of the site bounds).
 */
test.use({ viewport: { width: 1600, height: 900 } });

// Software-GL scene boots eat most of the default 30 s cap by themselves.
test.setTimeout(120_000);

async function bootFreshPark(page: Page): Promise<void> {
  await page.goto("/play?new=1");
  await expect(page.getByTestId("hud-money")).toHaveText("$75000", { timeout: 30_000 });
  await expect(page.getByTestId("scene-ready")).toBeAttached({ timeout: 45_000 });
}

test("fresh park boots with the full HUD", async ({ page }) => {
  await bootFreshPark(page);
  await expect(page.getByTestId("dock-paths")).toBeVisible();
  await expect(page.getByTestId("dock-scenery")).toBeVisible();
  await expect(page.getByTestId("dock-bulldoze")).toBeVisible();
  await expect(page.getByTestId("speed-1")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("canvas")).toBeAttached();
});

test("speed controls and pause respond", async ({ page }) => {
  await bootFreshPark(page);
  await page.getByTestId("speed-4").click();
  await expect(page.getByTestId("speed-4")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press(" ");
  await expect(page.getByTestId("speed-0")).toHaveAttribute("aria-pressed", "true");
});

test("build, undo, save, and continue round-trip", async ({ page }) => {
  await bootFreshPark(page);

  // Paint a short path with a drag across the meadow center.
  await page.getByTestId("dock-paths").click();
  await page.mouse.move(700, 500);
  await page.mouse.down();
  for (let x = 700; x <= 900; x += 25) {
    await page.mouse.move(x, 500);
  }
  await page.mouse.up();
  await expect(page.getByTestId("hud-money")).not.toHaveText("$75000");
  const afterPath = await page.getByTestId("hud-money").innerText();

  // Place a tree from the palette.
  await page.getByTestId("dock-scenery").click();
  await page.getByTestId("palette-naturekit-tree-oak").click();
  await page.mouse.click(800, 400);
  await page.keyboard.press("Escape"); // leave place mode
  const afterTree = await page.getByTestId("hud-money").innerText();
  expect(afterTree).not.toBe(afterPath);

  // Undo the tree — money returns to the post-path value.
  await page.keyboard.press("Control+z");
  await expect(page.getByTestId("hud-money")).toHaveText(afterPath);
  // Redo it again for the save.
  await page.keyboard.press("Control+y");
  await expect(page.getByTestId("hud-money")).toHaveText(afterTree);

  // Save via the pause menu, then load through the continue route.
  await page.keyboard.press("Escape");
  await page.getByTestId("pause-save").click();
  await expect(page.getByTestId("pause-save")).toHaveText(/Saved/);
  await page.goto("/play");
  await expect(page.getByTestId("hud-money")).toHaveText(afterTree, { timeout: 30_000 });
});

test("title CONTINUE goes live once a save exists", async ({ page }) => {
  await bootFreshPark(page);
  await page.keyboard.press("Escape");
  await page.getByTestId("pause-save").click();
  await expect(page.getByTestId("pause-save")).toHaveText(/Saved/);
  await page.goto("/");
  await expect(page.getByTestId("menu-continue")).toBeEnabled();
  await page.getByTestId("menu-continue").click();
  await expect(page).toHaveURL(/\/play$/);
});
