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

// Software-GL scene boots eat most of the default 30 s cap by themselves —
// and the two long flow tests build whole parks through the real UI.
test.setTimeout(180_000);

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

test("M3: snap a coaster circuit, test it, open it", async ({ page }) => {
  await bootFreshPark(page);
  // A short path spine so the park has walkable ground near the ride.
  await page.getByTestId("dock-paths").click();
  await page.mouse.move(800, 780);
  await page.mouse.down();
  for (let y = 780; y >= 430; y -= 20) {
    await page.mouse.move(800, y);
  }
  await page.mouse.up();
  await page.keyboard.press("Escape");

  // Pause the sim while snapping — builders do, and the panel stays snappy
  // on the software-GL runner.
  await page.keyboard.press(" ");
  // Start a Mousetrap west of the spine and snap the starter oval.
  await page.getByTestId("dock-rides").click();
  await page.getByTestId("ride-start-mouse").click();
  await page.mouse.click(640, 560);
  await expect(page.getByTestId("track-builder")).toBeVisible();
  for (const id of [
    "piece-straight",
    "piece-corner-small",
    "piece-corner-small",
    "piece-straight",
    "piece-straight",
    "piece-corner-small",
    "piece-corner-small",
  ]) {
    await page.getByTestId(id).click();
  }
  await expect(page.getByTestId("builder-status")).toHaveText(/closed/i);
  await expect(page.getByTestId("builder-stats")).toBeVisible();

  // Unpause, test at 4×, then open from the inspector once the test passes.
  await page.getByTestId("builder-test").click();
  await page.getByTestId("speed-4").click();
  await page.getByTestId("builder-done").click();
  await expect(page.getByTestId("ride-inspector")).toBeVisible();
  await expect(page.getByTestId("ride-open")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("ride-open").click();
  await expect(page.getByTestId("ride-state")).toHaveText(/open/i);
});

test("M4: the management window opens the books, lends, and reads the rating", async ({ page }) => {
  await bootFreshPark(page);

  // Two clicks from the HUD to anything the tycoon layer produces (UI_UX §7.1).
  await page.getByTestId("dock-manage").click();
  await expect(page.getByTestId("manage-window")).toBeVisible();
  await expect(page.getByTestId("receivership-banner")).toBeHidden();

  // A fresh park's land alone clears the debt ratio for the smallest loan.
  await page.getByRole("tab", { name: "Loans" }).click();
  await expect(page.getByTestId("credit-grade")).toHaveText("C");
  await page.getByTestId("take-loan-piggy").click();
  // $75,000 + $10,000 principal − $100 origination fee.
  await expect(page.getByTestId("hud-money")).toHaveText("$84900");
  await expect(page.getByTestId("pay-loan-1")).toBeVisible();
  await expect(page.getByTestId("hud-debt")).toBeVisible();

  // Rating reads neutral on an empty park and expands to its causes.
  await page.getByRole("tab", { name: "Rating" }).click();
  await expect(page.getByTestId("rating-stars")).toHaveText("2.5");
  await page.getByTestId("rating-sub-fun").click();
  await expect(page.getByTestId("manage-window")).toContainText("no rides");

  // Escape closes the window rather than falling through to the pause menu.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("manage-window")).toBeHidden();
  await expect(page.getByTestId("pause-save")).toBeHidden();
});

test("debt pass: a shop can be priced, and says when guests think it's steep", async ({
  page,
}) => {
  await bootFreshPark(page);
  await page.getByTestId("dock-paths").click();
  await page.mouse.move(800, 780);
  await page.mouse.down();
  for (let y = 780; y >= 420; y -= 20) {
    await page.mouse.move(800, y);
  }
  await page.mouse.up();

  await page.getByTestId("dock-shops").click();
  await page.getByTestId("palette-coasterkit-stall-food").click();
  await page.mouse.click(742, 560);
  await page.keyboard.press("Escape");

  // Clicking the stall in inspect mode opens its price panel.
  await page.mouse.click(742, 560);
  await expect(page.getByTestId("shop-inspector")).toBeVisible();
  await expect(page.getByTestId("shop-price")).toHaveText("$6");
  await expect(page.getByTestId("shop-fair-hint")).not.toContainText("steep");

  // Raising the price must actually move the number — the sim can accept the
  // command while the panel shows a stale one if worldVersion does not bump.
  for (let i = 0; i < 8; i++) {
    await page.getByTestId("shop-price-up").click();
  }
  await expect(page.getByTestId("shop-price")).toHaveText("$10");
  await expect(page.getByTestId("shop-fair-hint")).toContainText("steep");

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("shop-inspector")).toBeHidden();
});

test("M2: open the park and guests arrive; goals progress", async ({ page }) => {
  await bootFreshPark(page);
  // Path spine + a snack stall beside it.
  await page.getByTestId("dock-paths").click();
  await page.mouse.move(800, 780);
  await page.mouse.down();
  for (let y = 780; y >= 400; y -= 20) {
    await page.mouse.move(800, y);
  }
  await page.mouse.up();
  await page.getByTestId("dock-shops").click();
  await page.getByTestId("palette-coasterkit-stall-food").click();
  await page.mouse.click(742, 560);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("goal-panel")).toBeVisible();
  // Open the gate and fast-forward.
  await page.getByTestId("park-toggle").click();
  await page.getByTestId("speed-4").click();
  await expect
    .poll(async () => Number(await page.getByTestId("hud-guests").innerText()), {
      timeout: 60_000,
    })
    .toBeGreaterThan(2);
  // Staff popover hires a janitor.
  await page.getByTestId("dock-staff").click();
  await page.getByTestId("hire-janitor").click();
  await expect(page.getByTestId("janitor-count")).toHaveText("1");
});
