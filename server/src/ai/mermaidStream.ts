const DIAGRAM_START =
  /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|gantt|pie|mindmap|journey|gitGraph|timeline|quadrantChart|requirementDiagram|C4Context|sankey|xychart|block)\b/;

/**
 * Turns a model reply into pure Mermaid source, incrementally.
 *
 * The editor feeds the streamed text straight into its Mermaid parser, so anything else
 * (```mermaid fences, "Sure, here is…", trailing remarks) would fail as a syntax error.
 * Providers add those wrappers all the time, so we strip them while streaming:
 *
 *   prose ```mermaid\nDIAGRAM\n``` more prose   ->   DIAGRAM
 */
export class MermaidStreamFilter {
  private state: "seek" | "body" | "done" = "seek";
  private pending = "";
  private produced = false;

  get hasOutput() {
    return this.produced;
  }

  /** Feeds a delta; returns the text (possibly empty) that can be shown now. */
  push(delta: string): string {
    if (this.state === "done") {
      return "";
    }
    this.pending += delta;
    if (this.state === "seek") {
      this.trySeek(false);
    }
    return this.state === "body" ? this.drainBody(false) : "";
  }

  /** End of stream: releases anything held back. */
  end(): string {
    if (this.state === "seek") {
      this.trySeek(true);
    }
    return this.state === "body" ? this.drainBody(true) : "";
  }

  private trySeek(final: boolean) {
    const fence = /```[ \t]*(?:mermaid)?[ \t]*\r?\n/i.exec(this.pending);
    if (fence) {
      this.pending = this.pending.slice(fence.index + fence[0].length);
      this.state = "body";
      return;
    }
    // no fence: a bare diagram (possibly after a line or two of chatter)
    const lines = this.pending.split(/\r?\n/);
    const idx = lines.findIndex((l) => DIAGRAM_START.test(l.trim()));
    // only commit once the diagram keyword line is complete, or the stream ended
    if (idx !== -1 && (idx < lines.length - 1 || final)) {
      this.pending = lines.slice(idx).join("\n");
      this.state = "body";
    } else if (final) {
      this.pending = "";
      this.state = "done";
    }
  }

  private drainBody(final: boolean): string {
    const close = this.pending.indexOf("```");
    let out: string;
    if (close !== -1) {
      out = this.pending.slice(0, close);
      this.pending = "";
      this.state = "done";
    } else if (final) {
      out = this.pending;
      this.pending = "";
      this.state = "done";
    } else {
      // hold back trailing whitespace/backticks: they may precede (or be) the closing fence
      const m = /[\s`]+$/.exec(this.pending);
      const keep = m ? m[0].length : 0;
      out = this.pending.slice(0, this.pending.length - keep);
      this.pending = this.pending.slice(this.pending.length - keep);
    }
    if (!this.produced) {
      out = out.replace(/^\s+/, "");
    }
    if (this.state === "done") {
      out = out.replace(/\s+$/, "");
    }
    if (out) {
      this.produced = true;
    }
    return out;
  }
}

/** Convenience for whole replies. */
export const toMermaidSource = (reply: string): string | null => {
  const f = new MermaidStreamFilter();
  const text = f.push(reply) + f.end();
  return text.trim() ? text : null;
};
