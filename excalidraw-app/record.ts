declare global {
  interface Window {
    record: typeof Record;
  }
}

export class Record {
  private static events: string = "";
  private static timestamp: number = 0;

  public static start() {
    Record.events += `  await page.setViewportSize({ width: ${window.innerWidth}, height: ${window.innerHeight} });\n`;
    Record.events += `await page.goto("http://localhost:3000");`;
    Record.events += `await page.waitForLoadState("load");`;

    // Record.events += "  const mask = [\n";
    // Record.events += `    page.getByRole("button", { name: "Share" }),\n`;
    // Record.events += `    page.getByTitle("Library").locator("div"),\n`;
    // Record.events += "  ];\n";

    // capture a snapshot of localStorage (if available) to include in the header
    Record.events += "  await page.evaluate(() => {\n";
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key != null) {
          const value = JSON.stringify(localStorage.getItem(key));
          Record.events += `    localStorage.getItem("${key}");\n`;
          Record.events += `    localStorage.setItem("${key}", ${value});\n`;
        }
      }
    } catch {}
    Record.events += "  });\n";
    Record.events += "  await page.reload();\n";
    Record.events += `  await page.waitForLoadState("load");\n`;

    // Set up the events
    Record.timestamp = performance.now();

    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  public static stop() {
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }

  /// Displays a window as an absolutely positioned DIV with the generated
  /// events within <pre> tags as formatted JSON, so it can be copied easily.
  public static showGeneratedEvents() {
    const div = document.createElement("div");
    div.style.position = "absolute";
    div.style.top = "10px";
    div.style.right = "10px";
    div.style.left = "10px";
    div.style.height = "60vh";
    div.style.backgroundColor = "gray";
    div.style.padding = "10px";
    div.style.zIndex = "10000";

    const pre = document.createElement("pre");
    pre.textContent = this.events;
    // avoid overlap with the close button and limit height for large event dumps
    pre.style.marginTop = "18px";
    pre.style.maxHeight = "60vh";
    pre.style.overflow = "auto";
    div.appendChild(pre);

    const copyBtn = document.createElement("button");
    copyBtn.textContent = "Copy";
    copyBtn.title = "Copy generated events to clipboard";
    copyBtn.setAttribute("aria-label", "Copy generated events to clipboard");
    copyBtn.style.position = "absolute";
    copyBtn.style.top = "4px";
    copyBtn.style.left = "4px";
    copyBtn.style.border = "none";
    copyBtn.style.background = "transparent";
    copyBtn.style.fontSize = "12px";
    copyBtn.style.lineHeight = "1";
    copyBtn.style.cursor = "pointer";
    copyBtn.style.padding = "4px 8px";
    copyBtn.addEventListener("click", async () => {
      const text = pre.textContent ?? "";
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        const orig = copyBtn.textContent;
        copyBtn.textContent = "Copied";
        setTimeout(() => (copyBtn.textContent = orig), 1000);
      } catch {}
    });
    div.appendChild(copyBtn);

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.title = "Close";
    closeBtn.style.position = "absolute";
    closeBtn.style.top = "4px";
    closeBtn.style.right = "4px";
    closeBtn.style.border = "none";
    closeBtn.style.background = "transparent";
    closeBtn.style.fontSize = "18px";
    closeBtn.style.lineHeight = "1";
    closeBtn.style.cursor = "pointer";
    closeBtn.addEventListener("click", () => {
      // remove the dialog from DOM
      if (div.parentNode) {
        div.parentNode.removeChild(div);
      }
    });
    div.appendChild(closeBtn);

    document.body.appendChild(div);
  }

  private static onMouseMove(event: MouseEvent) {
    if (
      event.clientX < 0 ||
      event.clientX > window.innerWidth ||
      event.clientY < 0 ||
      event.clientY > window.innerHeight
    ) {
      return;
    }

    const now = event.timeStamp || performance.now();
    const delay = now - Record.timestamp;
    Record.timestamp = now;

    if (delay > 0) {
      Record.events += `  await page.waitForTimeout(${delay});\n`;
    }
    Record.events += `  await page.mouse.move(${event.clientX}, ${event.clientY});\n`;
  }

  private static onMouseDown(event: MouseEvent) {
    const now = event.timeStamp || performance.now();
    const delay = now - Record.timestamp;
    Record.timestamp = now;

    if (delay > 0) {
      Record.events += `  await page.waitForTimeout(${delay});\n`;
    }
    const button =
      event.button === 0 ? "left" : event.button === 1 ? "middle" : "right";
    Record.events += `  await page.mouse.down({ button: "${button}" });\n`;
  }

  private static onMouseUp(event: MouseEvent) {
    const now = event.timeStamp || performance.now();
    const delay = now - Record.timestamp;
    Record.timestamp = now;

    if (delay > 0) {
      Record.events += `  await page.waitForTimeout(${delay});\n`;
    }
    const button =
      event.button === 0 ? "left" : event.button === 1 ? "middle" : "right";
    Record.events += `  await page.mouse.down({ button: "${button}" });\n`;

    Record.events +=
      "  await expect(page).toHaveScreenshot({ maxDiffPixels: 100 });\n";
  }

  private static onKeyDown(event: KeyboardEvent) {
    const now = event.timeStamp || performance.now();
    const delay = now - Record.timestamp;
    Record.timestamp = now;

    if (delay > 0) {
      Record.events += `  await page.waitForTimeout(${delay});\n`;
    }
    Record.events += `  await page.keyboard.down("${event.key}");\n`;
  }

  private static onKeyUp(event: KeyboardEvent) {
    const now = event.timeStamp || performance.now();
    const delay = now - Record.timestamp;
    Record.timestamp = now;

    if (delay > 0) {
      Record.events += `  await page.waitForTimeout(${delay});\n`;
    }
    Record.events += `  await page.keyboard.up("${event.key}");\n`;

    Record.events +=
      "  await expect(page).toHaveScreenshot({ maxDiffPixels: 100 });\n";
  }
}

window.record = Record;
