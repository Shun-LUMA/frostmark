import { test, expect } from "@playwright/test";
test("welcome renders with navigation and code highlighting", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A little space to read." }),
  ).toBeVisible();
  await expect(page.locator(".codeblock .hljs-keyword").first()).toBeVisible();
  await expect(page.locator("article table")).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Table of contents" })
      .getByText("Made for the words"),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/browser-light.png" });
});
test("appearance, size and width survive a reload", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Reading preferences", exact: true })
    .click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.getByLabel("Reading width", { exact: true }).selectOption("wide");
  await page.getByRole("button", { name: "Larger text", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("article")).toHaveCSS("font-size", "18px");
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("article")).toHaveClass(/width-wide/);
  await expect(page.locator("article")).toHaveCSS("font-size", "18px");
  await page.screenshot({ path: "test-results/browser-dark.png" });
});
test("local file opening, duplicate headings, HTML safety, and tabs", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "sample.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(
        "# Sample\n\n## Repeat\n\nA paragraph.\n\n## Repeat\n\n<script>window.PWNED=true</script>\n\n![private](https://example.invalid/track.png)",
      ),
    });
  await expect(
    page.getByRole("heading", { name: "Sample", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#repeat-1")).toBeVisible();
  expect(await page.evaluate(() => window.PWNED)).toBeUndefined();
  await expect(
    page.getByText("Remote image blocked for privacy", { exact: true }),
  ).toBeVisible();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "second.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Second file"),
    });
  await expect(page.getByRole("tab")).toHaveCount(2);
  await page.getByRole("tab", { name: "sample.md", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sample", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close sample.md", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Second file", exact: true }),
  ).toBeVisible();
});
test("keyboard controls and outline toggle", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".app")).toHaveAttribute("data-ready", "true");
  await page.keyboard.press("Control+f");
  await expect(
    page.getByRole("textbox", { name: "Find text", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("textbox", { name: "Find text", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Control+=");
  await expect(page.locator("article")).toHaveCSS("font-size", "18px");
  await page.keyboard.press("Control+0");
  await expect(page.locator("article")).toHaveCSS("font-size", "17px");
  await page
    .getByRole("button", { name: "Hide navigation", exact: true })
    .click();
  await expect(page.locator(".sidebar")).toBeHidden();
  await page
    .getByRole("button", { name: "Show navigation", exact: true })
    .click();
  await expect(page.locator(".sidebar")).toBeVisible();
});
