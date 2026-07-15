import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function clearStorage(page: Page, url = "/") {
  await page.goto(url);
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Build the rack/ }),
  ).toBeVisible();
}

async function createGame(page: Page, company = "Foxglove Hosting", slot = 1) {
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByLabel("Company name").fill(company);
  await page.getByLabel(new RegExp(`Slot ${String(slot)}`)).check();
  await page.getByRole("button", { name: "Initialize company" }).click();
  await expect(page.getByRole("heading", { name: "Bedroom" })).toBeVisible();
}

async function returnToMenu(page: Page) {
  await page.getByRole("button", { name: "Pause" }).click();
  await page
    .getByRole("button", { name: "Save & return to main menu" })
    .click();
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
}

async function installStarterHardware(page: Page) {
  const inventory = page.locator(".inventory-list article");
  await inventory
    .filter({ hasText: "Refurbished Desktop" })
    .getByRole("button", { name: /Install at/ })
    .click();
  await page.getByRole("button", { name: /Rack unit 5/ }).click();
  await inventory
    .filter({ hasText: "Consumer Router" })
    .getByRole("button", { name: /Install at/ })
    .click();
  await page.getByRole("button", { name: /Rack unit 6/ }).click();
  await inventory
    .filter({ hasText: "Power Strip" })
    .getByRole("button", { name: /Install at/ })
    .click();
  await page.getByRole("button", { name: /Rack unit 7/ }).click();
  await inventory
    .filter({ hasText: "Desk Fan" })
    .getByRole("button", { name: /Install at/ })
    .click();
  await expect(page.getByText("Nothing waiting on the floor")).toBeVisible();
}

async function pointerDrag(
  page: Page,
  source: ReturnType<Page["locator"]>,
  target: ReturnType<Page["locator"]>,
) {
  await source.hover();
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (sourceBox === null || targetBox === null)
    throw new Error("Drag target is not rendered");
  await page.mouse.down();
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2 + 12,
    sourceBox.y + sourceBox.height / 2,
    { steps: 3 },
  );
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();
}

async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await clearStorage(page);
});

test("main menu boots cleanly, disables Continue, and is accessible", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "New Game" })).toBeVisible();
  const brandParts = page.locator(".brand-lockup > div").first().locator("*");
  const brandBoxes = await brandParts.evaluateAll((elements) =>
    elements.map((element) => {
      const bounds = element.getBoundingClientRect();
      return { top: bounds.top, bottom: bounds.bottom };
    }),
  );
  expect(brandBoxes[1]?.top).toBeGreaterThanOrEqual(brandBoxes[0]?.bottom ?? 0);
  const continueButton = page.getByRole("button", { name: "Continue" });
  const newGameButton = page.getByRole("button", { name: "New Game" });
  const [continueBackground, newGameBackground] = await Promise.all([
    continueButton.evaluate((element) => getComputedStyle(element).background),
    newGameButton.evaluate((element) => getComputedStyle(element).background),
  ]);
  expect(continueBackground).not.toBe(newGameBackground);
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test("options persist independently and remain accessible", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Options" }).click();
  await page.getByLabel("Interface scale").selectOption("compact");
  const saveOptions = page.getByRole("button", { name: "Save options" });
  const compactSize = await saveOptions.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  await page.getByLabel("Interface scale").selectOption("large");
  const largeSize = await saveOptions.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  expect(largeSize).toBeGreaterThan(compactSize);
  await page.getByLabel("Reduced motion").check();
  await page.getByLabel("Autosave interval").selectOption("900");
  await page.getByRole("button", { name: "Save options" }).click();
  await expectNoA11yViolations(page);
  await page.reload();
  await page.getByRole("button", { name: "Options" }).click();
  await expect(page.getByLabel("Interface scale")).toHaveValue("large");
  await expect(page.getByLabel("Reduced motion")).toBeChecked();
  await expect(page.getByLabel("Autosave interval")).toHaveValue("900");
});

test("unsaved scale preview reverts on exit", async ({ page }) => {
  await page.getByRole("button", { name: "Options" }).click();
  await page.getByLabel("Interface scale").selectOption("large");
  await page.getByRole("button", { name: /Main menu/ }).click();
  await page.getByRole("button", { name: "Options" }).click();
  await expect(page.getByLabel("Interface scale")).toHaveValue("standard");
});

test("mobile headers and empty save cards stay compact", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Options" }).click();
  const backButton = page.getByRole("button", { name: /Main menu/ });
  await expect(backButton).toHaveCSS("white-space", "nowrap");
  expect(
    await backButton.evaluate((element) => element.scrollWidth),
  ).toBeLessThanOrEqual(
    await backButton.evaluate((element) => element.clientWidth),
  );
  await backButton.click();
  await page.getByRole("button", { name: "Load Game" }).click();
  const emptyCards = page.locator(".save-card");
  await expect(emptyCards).toHaveCount(5);
  const heights = await emptyCards.evaluateAll((cards) =>
    cards.map((card) => card.getBoundingClientRect().height),
  );
  expect(Math.max(...heights)).toBeLessThan(220);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("new game exposes the starting facility, inventory, and tutorial", async ({
  page,
}) => {
  await createGame(page, "Rack Fox LLC");
  await expect(page.getByText("$0.00").first()).toBeVisible();
  await expect(page.getByText("Refurbished Desktop")).toBeVisible();
  await expect(page.getByText("Consumer Router")).toBeVisible();
  await page.getByRole("button", { name: /Contracts/ }).click();
  await expect(
    page.getByRole("heading", { name: "Gravy's Garden Blog" }),
  ).toBeVisible();
  await expect(page.getByText("INSTALL HARDWARE")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Accept & assign to Rack A-01" }),
  ).toBeDisabled();
});

test("keyboard-safe placement powers real tutorial income", async ({
  page,
}) => {
  await createGame(page);
  await installStarterHardware(page);
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: /Contracts/ }).click();
  await expect(page.getByText("READY")).toBeVisible();
  await page
    .getByRole("button", { name: "Accept & assign to Rack A-01" })
    .click();
  await expect(page.getByText("Healthy", { exact: true })).toBeVisible();
  const cash = page
    .locator(".hud-value")
    .filter({ hasText: "Cash" })
    .locator("strong");
  const before = await cash.textContent();
  await expect(cash).not.toHaveText(before ?? "", { timeout: 4_000 });
});

test("inventory drag, rack reposition, and drag cancellation are atomic", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1800 });
  await createGame(page);
  const inventoryDesktop = page.getByRole("button", {
    name: "Drag Refurbished Desktop",
  });
  await pointerDrag(
    page,
    inventoryDesktop,
    page.getByRole("button", { name: /Rack unit 12/ }),
  );
  await expect(page.locator(".inventory-list")).not.toContainText(
    "Refurbished Desktop",
  );
  const installedHandle = page.getByRole("button", {
    name: "Drag Refurbished Desktop",
  });
  await pointerDrag(
    page,
    installedHandle,
    page.getByRole("button", { name: /^Rack unit 1,/ }),
  );
  await expect(
    page.getByText(/1U · Powered/).filter({ visible: true }),
  ).toBeVisible();

  const cancelHandle = page.getByRole("button", {
    name: "Drag Refurbished Desktop",
  });
  const box = await cancelHandle.boundingBox();
  if (box === null) throw new Error("Drag handle missing");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 100, box.y - 100, { steps: 8 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.getByRole("heading", { name: "Pause menu" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Drag Refurbished Desktop" }),
  ).toBeVisible();
});

test("installed equipment can be dragged back to inventory", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1800 });
  await createGame(page);
  await page
    .locator(".inventory-list article")
    .filter({ hasText: "Refurbished Desktop" })
    .getByRole("button", { name: /Install at/ })
    .click();
  await pointerDrag(
    page,
    page.getByRole("button", { name: "Drag Refurbished Desktop" }),
    page.getByLabel("Equipment inventory drop zone"),
  );
  await expect(page.locator(".inventory-list")).toContainText(
    /Refurbished desktop/i,
  );
  await expect(page.locator(".installed-panel")).not.toContainText(
    /Refurbished desktop/i,
  );
});

test("tutorial failure persists, reloads, and offers confirmed start-over", async ({
  page,
}) => {
  await clearStorage(page, "http://127.0.0.1:4174");
  await createGame(page, "Failed Tutorial Fox");
  await page.keyboard.press("F10");
  await page.getByRole("button", { name: "Tutorial failed" }).click();
  await expect(
    page.getByRole("heading", { name: "The first customer was lost." }),
  ).toBeVisible();
  await expect(page.getByText("Game saved.")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("heading", { name: "The first customer was lost." }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", {
      name: "Delete this company and start a new game",
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "New company" }),
  ).toBeVisible();
});

test("debt remains playable and bankruptcy uses the exact threshold", async ({
  page,
}) => {
  await clearStorage(page, "http://127.0.0.1:4174");
  await createGame(page, "Debt Fox");
  await page.keyboard.press("F10");
  await page.getByRole("button", { name: "Debt −$9,999.99" }).click();
  await expect(page.getByText(/Debt warning/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bedroom" })).toBeVisible();
  await page.getByRole("button", { name: "Bankruptcy at threshold" }).click();
  await expect(
    page.getByRole("heading", { name: "The company is bankrupt." }),
  ).toBeVisible();
  await expect(page.getByText(/−\$10,000/)).toBeVisible();
});

test("save, menu, refresh, and Continue restore progress", async ({ page }) => {
  await createGame(page, "Persistent Fox");
  await installStarterHardware(page);
  await returnToMenu(page);
  await page.reload();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Nothing waiting on the floor")).toBeVisible();
  await expect(page.getByText("Persistent Fox")).toBeVisible();
});

test("save manager deletes only the selected slot", async ({ page }) => {
  await createGame(page, "First Slot", 1);
  await returnToMenu(page);
  await createGame(page, "Second Slot", 2);
  await returnToMenu(page);
  await page.getByRole("button", { name: "Load Game" }).click();
  await expectNoA11yViolations(page);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .locator(".save-card")
    .filter({ hasText: "First Slot" })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByText("Second Slot")).toBeVisible();
  await expect(page.getByText("First Slot")).not.toBeVisible();
});

test("valid export/import round trip and malformed import is non-destructive", async ({
  page,
}) => {
  await createGame(page, "Exportable Fox");
  await returnToMenu(page);
  await page.getByRole("button", { name: "Load Game" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .locator(".save-card")
    .filter({ hasText: "Exportable Fox" })
    .getByRole("button", { name: "Export" })
    .click();
  const download = await downloadPromise;
  const path = await download.path();
  await page
    .locator(".save-card")
    .nth(1)
    .getByLabel("Import")
    .setInputFiles(path);
  await expect(
    page.locator(".save-card").filter({ hasText: "Exportable Fox" }),
  ).toHaveCount(2);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .locator(".save-card")
    .nth(0)
    .getByLabel("Import")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from("{broken"),
    });
  await expect(page.locator(".save-card").first()).toContainText(
    "Exportable Fox",
  );
});

test("corrupt current save offers last-known-good restoration", async ({
  page,
}) => {
  await createGame(page, "Recoverable Fox");
  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("button", { name: /Save now/ }).click();
  await expect(page.getByText("Game saved.")).toBeVisible();
  await page.getByRole("button", { name: "Resume" }).click();
  await page.addInitScript(() => {
    window.localStorage.setItem("racks-to-riches:slot-1:current", "corrupt");
  });
  await page.reload();
  await page.getByRole("button", { name: "Load Game" }).click();
  await expect(page.locator(".save-card").first()).toContainText("recoverable");
  await page.getByRole("button", { name: "Restore backup" }).click();
  await expect(page.locator(".save-card").first()).toContainText(
    "Recoverable Fox",
  );
});

test("QA build exposes F10 tools, undo, completion scenario, and modified saves", async ({
  page,
}) => {
  await clearStorage(page, "http://127.0.0.1:4174");
  await createGame(page, "QA Fox");
  await page.keyboard.press("F10");
  await expect(page.getByLabel("Development and QA tools")).toBeVisible();
  await page.getByRole("button", { name: "+25 reputation" }).click();
  await expect(page.getByText("Modified").locator("..")).toContainText("yes");
  await page.getByRole("button", { name: "Undo latest command" }).click();
  await page.getByRole("button", { name: "Marketplace unlocked" }).click();
  await page.keyboard.press("F10");
  await page.getByRole("button", { name: "Hardware store" }).click();
  await expect(
    page.getByRole("heading", { name: "Bedroom hardware store" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("button", { name: /Save now/ }).click();
  await page
    .getByRole("button", { name: "Save & return to main menu" })
    .click();
  await page.getByRole("button", { name: "Load Game" }).click();
  await expect(page.locator(".save-card").first()).toContainText("QA tools");
});

test("release build has no development panel", async ({ page }) => {
  await createGame(page);
  await page.keyboard.press("F10");
  await expect(page.getByLabel("Development and QA tools")).toHaveCount(0);
});

test("QA error boundary presents recovery controls", async ({ page }) => {
  await page.goto("http://127.0.0.1:4174/?error-boundary-test");
  await expect(page.getByTestId("error-boundary")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Return to menu" }),
  ).toBeVisible();
});
