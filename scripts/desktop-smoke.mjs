import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const results = path.resolve("test-results");
await mkdir(results, { recursive: true });
const fixture = path.join(results, "reader-smoke.md");
const other = path.join(results, "linked.md");
const png = path.join(results, "tiny.png");
await writeFile(
  png,
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMioAAAAASUVORK5CYII=",
    "base64",
  ),
);
await writeFile(other, "# Linked document\n\nThis opened in a second tab.");
await writeFile(
  fixture,
  '# Desktop smoke test\n\n**Portable reader** with a table and code.\n\n## Formatting\n\n| Name | Value |\n|---|---|\n| Mode | Read only |\n\n```javascript\nconst message = "hello";\nconsole.log(message);\n```\n\n[Open linked document](linked.md)\n\n![Local image](tiny.png)\n\n![Tracking image](https://example.invalid/tracker.png)\n\n<script>window.UNSAFE_MARKDOWN=true</script>\n\n## Formatting\n\nDuplicate heading test.',
);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const before = hash(await readFile(fixture));
const exe = path.resolve("src-tauri/target/release/frostmark.exe");
let browser, child;
const errors = [];
try {
  child = spawn(exe, [fixture], {
    stdio: "inherit",
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: "--remote-debugging-port=9222",
    },
  });
  child.on("error", (e) => errors.push(String(e)));
  for (let i = 0; i < 90; i++) {
    try {
      browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
      break;
    } catch {
      if (child.exitCode !== null)
        throw Error(`App exited with ${child.exitCode}`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  assert(browser, "WebView2 debug connection did not become ready");
  const context = browser.contexts()[0];
  let page = context.pages()[0];
  if (!page) page = await context.waitForEvent("page", { timeout: 15000 });
  page.on("pageerror", (e) => errors.push(String(e)));
  const heading = page.getByRole("heading", {
    name: "Desktop smoke test",
    exact: true,
  });
  await heading.waitFor({ timeout: 30000 });
  await page.locator("article table").waitFor();
  await page.locator(".codeblock .hljs-keyword").first().waitFor();
  assert.equal(
    await page.evaluate(() => window.UNSAFE_MARKDOWN),
    undefined,
    "Untrusted HTML ran",
  );
  assert.equal(
    await page.locator("#formatting-1").count(),
    1,
    "Duplicate heading IDs should be unique",
  );
  await page
    .getByText("Remote image blocked for privacy", { exact: true })
    .waitFor();
  await page.locator('article img[alt="Local image"]').waitFor();
  const prefsButton = page.getByRole("button", {
    name: "Reading preferences",
    exact: true,
  });
  await prefsButton.click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await page.getByLabel("Reading width", { exact: true }).selectOption("wide");
  await page
    .getByRole("button", { name: "Close preferences", exact: true })
    .click();
  await page.screenshot({
    path: path.join(results, "desktop-dark.png"),
    fullPage: false,
  });
  await page
    .getByRole("link", { name: "Open linked document", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Linked document", exact: true })
    .waitFor();
  assert.equal(await page.getByRole("tab").count(), 2);
  await page.getByRole("tab", { name: "reader-smoke.md", exact: true }).click();
  await heading.waitFor();
  const security = await page.evaluate(
    async ({ fixture, png }) => {
      const call = (cmd, args) => window.__TAURI_INTERNALS__.invoke(cmd, args);
      const results = {};
      for (const [name, cmd, args] of [
        [
          "executable",
          "open_document",
          { path: png.replace("tiny.png", "bad.exe") },
        ],
        [
          "unsafeLink",
          "resolve_link",
          { documentPath: fixture, href: "javascript:alert(1)" },
        ],
        [
          "unsafeExternal",
          "open_external",
          { url: "file:///C:/Windows/notepad.exe" },
        ],
        [
          "outsideImage",
          "read_image",
          { documentPath: fixture, path: "../src-tauri/icons/icon.png" },
        ],
      ]) {
        try {
          await call(cmd, args);
          results[name] = false;
        } catch {
          results[name] = true;
        }
      }
      return results;
    },
    { fixture, png },
  );
  assert(
    Object.values(security).every(Boolean),
    `Security checks failed: ${JSON.stringify(security)}`,
  );
  await page.waitForTimeout(800);
  const saved = JSON.parse(
    await readFile(
      path.resolve("src-tauri/target/release/frostmark-settings.json"),
      "utf8",
    ),
  );
  assert.equal(saved.theme, "dark");
  assert.equal(saved.width, "wide");
  assert.equal(
    hash(await readFile(fixture)),
    before,
    "Viewer modified the Markdown source",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(results, "desktop-report.json"),
    JSON.stringify(
      {
        passed: true,
        security,
        sourceUnchanged: true,
        settingsSavedBesideExecutable: true,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "Desktop smoke passed: real WebView2 renderer, startup file, tabs, code, tables, images, links, preferences and security.",
  );
} catch (e) {
  if (browser) {
    try {
      await browser
        .contexts()[0]
        .pages()[0]
        ?.screenshot({ path: path.join(results, "failure.png") });
    } catch {}
  }
  throw e;
} finally {
  if (browser) await browser.close();
  if (child && child.exitCode === null) child.kill();
}
