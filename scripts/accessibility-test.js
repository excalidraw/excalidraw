const { chromium } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const fs = require("fs");
const path = require("path");

(async () => {
  try {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    const url = "http://localhost:3000";
    await page.goto(url);

    const results = await new AxeBuilder({ page }).analyze();

    const reportDir = path.resolve(__dirname, "../reports");
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir);
    }

    fs.writeFileSync(
      path.join(reportDir, "accessibility-report.json"),
      JSON.stringify(results, null, 2),
    );

    console.log("Accessibility report generated.");
    await browser.close();
  } catch (error) {
    console.error("Accessibility analysis failed:", error);
    process.exit(1);
  }
})();
