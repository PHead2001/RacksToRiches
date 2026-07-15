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
  await screenshot(page, testInfo, "options-390x844");
  await page.getByRole("button", { name: /Main menu/ }).click();
  await page.getByRole("button", { name: "Load Game" }).click();
  await screenshot(page, testInfo, "save-manager-390x844");
  await page.getByRole("button", { name: /Main menu/ }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await create(page, "Rendered Fox Hosting");
  await screenshot(page, testInfo, "facility-1440x900");
  await page.getByRole("button", { name: /Contracts/ }).click();
  await screenshot(page, testInfo, "contracts-1440x900");
  await page.getByRole("button", { name: "Hardware store" }).click();
  await screenshot(page, testInfo, "store-locked-1440x900");
  await page.getByRole("button", { name: "Pause" }).click();
  await screenshot(page, testInfo, "pause-1440x900");
  await page.getByRole("button", { name: "Resume" }).click();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await screenshot(page, testInfo, "facility-1920x1080");

  await clear(page, "http://127.0.0.1:4174");
  await create(page, "QA Render Fox");
  await page.keyboard.press("F10");
  await expect(page.getByLabel("Development and QA tools")).toBeVisible();
  await screenshot(page, testInfo, "development-panel-1920x1080");
  await page.getByRole("button", { name: "Marketplace unlocked" }).click();
  await page.keyboard.press("F10");
  await page.getByRole("button", { name: "Hardware store" }).click();
  await screenshot(page, testInfo, "store-unlocked-1920x1080");

  await page.goto("http://127.0.0.1:4174/?error-boundary-test");
  await expect(page.getByTestId("error-boundary")).toBeVisible();
  await screenshot(page, testInfo, "error-fallback-1920x1080");
});
