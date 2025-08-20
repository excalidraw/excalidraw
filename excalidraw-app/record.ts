declare global {
  interface Window {
    record: typeof Record;
  }
}

export type PlaybackEvent = (
  | {
      type: "mouse.move";
      x: number;
      y: number;
    }
  | {
      type: "mouse.down" | "mouse.up";
      button: "left" | "right" | "middle";
    }
  | {
      type: "keyboard.down" | "keyboard.up";
      key: string;
    }
  | {
      type: "header";
      width: number;
      height: number;
      localStorage: { [key: string]: string };
    }
) & {
  delay: number;
};

export class Record {
  private static events: PlaybackEvent[] = [];
  private static timestamp: number = 0;

  public static start() {
    // capture a snapshot of localStorage (if available) to include in the header
    const lsSnapshot: { [key: string]: string } = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key != null) {
          lsSnapshot[key] = localStorage.getItem(key) ?? "";
        }
      }
    } catch {}

    Record.events = [
      {
        type: "header",
        width: window.innerWidth,
        height: window.innerHeight,
        localStorage: lsSnapshot,
        delay: 0,
      },
    ];
    Record.timestamp = performance.now();

    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);

    try {
      const canvases = Array.from(
        document.querySelectorAll("canvas"),
      ) as HTMLCanvasElement[];
      for (const c of canvases) {
        c.addEventListener("mousemove", this.onMouseMove);
        c.addEventListener("mousedown", this.onMouseDown);
        c.addEventListener("mouseup", this.onMouseUp);
      }
    } catch {}
  }

  public static stop() {
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);

    // Remove listeners from any canvases we attached to
    try {
      const canvases = Array.from(
        document.querySelectorAll("canvas"),
      ) as HTMLCanvasElement[];
      for (const c of canvases) {
        c.removeEventListener("mousemove", this.onMouseMove);
        c.removeEventListener("mousedown", this.onMouseDown);
        c.removeEventListener("mouseup", this.onMouseUp);
      }
    } catch {}
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
    pre.textContent = JSON.stringify(this.events, null, 2);
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

    Record.events.push({
      type: "mouse.move",
      x: event.clientX,
      y: event.clientY,
      delay,
    });
  }

  private static onMouseDown(event: MouseEvent) {
    const now = event.timeStamp || performance.now();
    const delay = now - Record.timestamp;
    Record.timestamp = now;

    Record.events.push({
      type: "mouse.down",
      button:
        event.button === 0 ? "left" : event.button === 1 ? "middle" : "right",
      delay,
    });
  }

  private static onMouseUp(event: MouseEvent) {
    const now = event.timeStamp || performance.now();
    const delay = now - Record.timestamp;
    Record.timestamp = now;

    Record.events.push({
      type: "mouse.up",
      button:
        event.button === 0 ? "left" : event.button === 1 ? "middle" : "right",
      delay,
    });
  }

  private static onKeyDown(event: KeyboardEvent) {
    const now = event.timeStamp || performance.now();
    const delay = now - Record.timestamp;
    Record.timestamp = now;

    Record.events.push({
      type: "keyboard.down",
      key: event.key,
      delay,
    });
  }

  private static onKeyUp(event: KeyboardEvent) {
    const now = event.timeStamp || performance.now();
    const delay = now - Record.timestamp;
    Record.timestamp = now;

    Record.events.push({
      type: "keyboard.up",
      key: event.key,
      delay,
    });
  }
}

window.record = Record;
