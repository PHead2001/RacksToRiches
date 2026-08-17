import { expect, test, type Page, type TestInfo } from "@playwright/test";

async function screenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, `${name} horizontally overflows`).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
  });
}

async function clear(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Build the rack/ }),
  ).toBeVisible();
}

async function create(page: Page, company: string): Promise<void> {
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByLabel("Company name").fill(company);
  await page.getByRole("button", { name: "Initialize company" }).click();
  await expect(page.getByRole("heading", { name: "Bedroom" })).toBeVisible();
}

test("capture required Phase 2 rendered states without horizontal clipping", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await clear(page, "/");
  await screenshot(page, testInfo, "menu-1280x720");

  await page.getByRole("button", { name: "Load Game" }).click();
  await screenshot(page, testInfo, "save-manager-1280x720");
  await page.getByRole("button", { name: /Main menu/ }).click();
  await page.getByRole("button", { name: "Options" }).click();
  await screenshot(page, testInfo, "options-1280x720");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Interface scale").selectOption("compact");
  await screenshot(page, testInfo, "options-compact-390x844");
  await page.getByLabel("Interface scale").selectOption("large");
  await screenshot(page, testInfo, "options-large-390x844");
  await page.getByRole("button", { name: /Main menu/ }).click();
  await page.getByRole("button", { name: "Load Game" }).click();
  await screenshot(page, testInfo, "save-manager-empty-390x844");
  await page.getByRole("button", { name: /Main menu/ }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await create(page, "Rendered Fox Hosting");
  await screenshot(page, testInfo, "facility-1440x900");
  await page.getByRole("button", { name: /Contracts/ }).click();
  await screenshot(page, testInfo, "tutorial-install-hardware-1440x900");
  await page.getByRole("button", { name: "Hardware store" }).click();
  await screenshot(page, testInfo, "store-locked-1440x900");
  await page.getByRole("button", { name: "Pause" }).click();
  await screenshot(page, testInfo, "pause-1440x900");
  await page.getByRole("button", { name: "Resume" }).click();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await screenshot(page, testInfo, "facility-1920x1080");
  await page.keyboard.press("F10");
  await expect(page.getByLabel("Development and QA tools")).toHaveCount(0);
  await screenshot(page, testInfo, "release-no-qa-panel-1920x1080");
  await page.getByRole("button", { name: "Pause" }).click();
  await page
    .getByRole("button", { name: "Save & return to main menu" })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Load Game" }).click();
  await screenshot(page, testInfo, "save-manager-occupied-390x844");

  await clear(page, "http://127.0.0.1:4174");
  await page.setViewportSize({ width: 1440, height: 900 });
  await create(page, "QA Render Fox");
  await page.keyboard.press("F10");
  await expect(page.getByLabel("Development and QA tools")).toBeVisible();
  await screenshot(page, testInfo, "development-panel-1920x1080");
  await page.getByRole("button", { name: "Long equipment lists" }).click();
  await page.keyboard.press("F10");
  await page.setViewportSize({ width: 1280, height: 720 });
  await screenshot(page, testInfo, "bounded-equipment-lists-1280x720");
  await page.keyboard.press("F10");
  await page.getByRole("button", { name: "Residual service pool" }).click();
  await page.keyboard.press("F10");
  await page.getByRole("button", { name: /Contracts/ }).click();
  await screenshot(page, testInfo, "residual-service-pool-1280x720");
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot(page, testInfo, "mobile-contract-count-390x844");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Facility" }).click();
  await page
    .locator(".inventory-list article")
    .first()
    .getByRole("button", { name: /Install at/ })
    .click();
  await screenshot(page, testInfo, "warning-notification-1440x900");
  await page.waitForTimeout(8_100);
  await screenshot(page, testInfo, "warning-expired-1440x900");
  await page.keyboard.press("F10");
  await page.getByRole("button", { name: "+25 reputation" }).click();
  await page.getByRole("button", { name: "+25 reputation" }).click();
  await screenshot(page, testInfo, "qa-duplicate-command-log-1440x900");
  await page.getByRole("button", { name: "Marketplace unlocked" }).click();
  await page.keyboard.press("F10");
  await page.getByRole("button", { name: "Hardware store" }).click();
  await screenshot(page, testInfo, "store-unlocked-1920x1080");

  await page.keyboard.press("F10");
  await page.getByRole("button", { name: "Tutorial ready" }).click();
  await page.keyboard.press("F10");
  await page.getByRole("button", { name: /Contracts/ }).click();
  await screenshot(page, testInfo, "tutorial-ready-1440x900");

  await page.keyboard.press("F10");
  await page.getByRole("button", { name: "Tutorial profitable" }).click();
  await page.getByRole("button", { name: "Force SLA warning" }).click();
  await page.keyboard.press("F10");
  await page.getByRole("button", { name: /Contracts/ }).click();
  await screenshot(page, testInfo, "sla-buffer-consumed-1440x900");

  await page.keyboard.press("F10");
  await page.getByRole("button", { name: "Smart rack reflow" }).click();
  await page.keyboard.press("F10");
  await page.getByRole("button", { name: "Facility" }).click();
  await screenshot(page, testInfo, "rack-after-reflow-1440x900");

  await page.keyboard.press("F10");
  await page.getByRole("button", { name: "Fresh game" }).click();
  await page.keyboard.press("F10");
  const drag = page.getByRole("button", { name: "Drag Refurbished Desktop" });
  const target = page.getByRole("button", { name: /Rack unit 12/ });
  const dragBox = await drag.boundingBox();
  const targetBox = await target.boundingBox();
  if (dragBox === null || targetBox === null) throw new Error("drag fixture");
  await page.mouse.move(
    dragBox.x + dragBox.width / 2,
    dragBox.y + dragBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 10 },
  );
  await screenshot(page, testInfo, "smart-placement-preview-1440x900");
  await page.keyboard.press("Escape");
  await page.mouse.up();

  await page.keyboard.press("F10");
  await page.getByRole("button", { name: "Tutorial profitable" }).click();
  await page.getByRole("button", { name: "Complete active" }).click();
  await page.keyboard.press("F10");
  await screenshot(page, testInfo, "tutorial-complete-notification-1440x900");

  await page.keyboard.press("F10");
  await page.getByRole("button", { name: "Tutorial failed" }).click();
  await page.keyboard.press("F10");
  await screenshot(page, testInfo, "tutorial-game-over-1440x900");

  await page.keyboard.press("F10");
  await page.getByRole("button", { name: "Debt −$9,999.99" }).click();
  await page.keyboard.press("F10");
  await screenshot(page, testInfo, "negative-cash-warning-1440x900");
  await page.keyboard.press("F10");
  await page.getByRole("button", { name: "Bankruptcy at threshold" }).click();
  await page.keyboard.press("F10");
  await screenshot(page, testInfo, "bankruptcy-1440x900");

  await page.goto("http://127.0.0.1:4174/?error-boundary-test");
  await expect(page.getByTestId("error-boundary")).toBeVisible();
  await screenshot(page, testInfo, "error-fallback-1920x1080");
});
