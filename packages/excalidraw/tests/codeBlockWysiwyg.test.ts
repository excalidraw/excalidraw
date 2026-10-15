import { describe, it, expect } from "vitest";

import {
  handleCodeBlockSmartBackspace,
  handleCodeBlockTab,
} from "../wysiwyg/codeBlockWysiwyg";

describe("codeBlockWysiwyg keyboard interactions", () => {
  describe("handleCodeBlockSmartBackspace", () => {
    it("deletes a 2-space tab in one backspace when cursor is at leading indentation", () => {
      const res = handleCodeBlockSmartBackspace({
        val: "  ",
        start: 2,
        end: 2,
      });

      expect(res).not.toBeNull();
      expect(res?.nextVal).toBe("");
      expect(res?.nextStart).toBe(0);
      expect(res?.nextEnd).toBe(0);
    });

    it("unindents 4 spaces down to 2 spaces, and subsequent backspace down to 0", () => {
      const res1 = handleCodeBlockSmartBackspace({
        val: "    ",
        start: 4,
        end: 4,
      });

      expect(res1).not.toBeNull();
      expect(res1?.nextVal).toBe("  ");
      expect(res1?.nextStart).toBe(2);
      expect(res1?.nextEnd).toBe(2);

      const res2 = handleCodeBlockSmartBackspace({
        val: res1!.nextVal,
        start: res1!.nextStart,
        end: res1!.nextEnd,
      });

      expect(res2).not.toBeNull();
      expect(res2?.nextVal).toBe("");
      expect(res2?.nextStart).toBe(0);
      expect(res2?.nextEnd).toBe(0);
    });

    it("snaps 3 spaces down to the 2-space tab stop", () => {
      const res = handleCodeBlockSmartBackspace({
        val: "   ",
        start: 3,
        end: 3,
      });

      expect(res).not.toBeNull();
      expect(res?.nextVal).toBe("  ");
      expect(res?.nextStart).toBe(2);
      expect(res?.nextEnd).toBe(2);
    });

    it("deletes single space if indentation was only 1 space", () => {
      const res = handleCodeBlockSmartBackspace({
        val: " ",
        start: 1,
        end: 1,
      });

      expect(res).not.toBeNull();
      expect(res?.nextVal).toBe("");
      expect(res?.nextStart).toBe(0);
      expect(res?.nextEnd).toBe(0);
    });

    it("returns null at start of line so native backspace merges with previous line", () => {
      const res = handleCodeBlockSmartBackspace({
        val: "line1\nline2",
        start: 6, // right at start of 'line2'
        end: 6,
      });

      expect(res).toBeNull();
    });

    it("unindents a line of code when caret is placed before the code", () => {
      const val = "    const x = 1;";
      const res1 = handleCodeBlockSmartBackspace({
        val,
        start: 4, // right before 'const'
        end: 4,
      });

      expect(res1).not.toBeNull();
      expect(res1?.nextVal).toBe("  const x = 1;");
      expect(res1?.nextStart).toBe(2);
      expect(res1?.nextEnd).toBe(2);

      const res2 = handleCodeBlockSmartBackspace({
        val: res1!.nextVal,
        start: res1!.nextStart,
        end: res1!.nextEnd,
      });

      expect(res2).not.toBeNull();
      expect(res2?.nextVal).toBe("const x = 1;");
      expect(res2?.nextStart).toBe(0);
      expect(res2?.nextEnd).toBe(0);
    });

    it("unindents auto-indented empty line after Enter", () => {
      const val = "function foo() {\n  ";
      const start = val.length; // 18
      const res = handleCodeBlockSmartBackspace({
        val,
        start,
        end: start,
      });

      expect(res).not.toBeNull();
      expect(res?.nextVal).toBe("function foo() {\n");
      expect(res?.nextStart).toBe(17);
      expect(res?.nextEnd).toBe(17);

      const res2 = handleCodeBlockSmartBackspace({
        val: res!.nextVal,
        start: res!.nextStart,
        end: res!.nextEnd,
      });
      expect(res2).toBeNull();
    });

    it("deletes a 2-space tab inserted after code", () => {
      const val = "const x = 1;  ";
      const res = handleCodeBlockSmartBackspace({
        val,
        start: val.length,
        end: val.length,
      });

      expect(res).not.toBeNull();
      expect(res?.nextVal).toBe("const x = 1;");
      expect(res?.nextStart).toBe(12);
      expect(res?.nextEnd).toBe(12);
    });

    it("returns null for a single space after code so normal typing delete proceeds", () => {
      const val = "const x = 1; ";
      const res = handleCodeBlockSmartBackspace({
        val,
        start: val.length,
        end: val.length,
      });

      expect(res).toBeNull();
    });

    it("deletes matching bracket pairs in one stroke", () => {
      const pairs = [
        ["()", 1],
        ["{}", 1],
        ["[]", 1],
        ['""', 1],
        ["''", 1],
        ["``", 1],
      ] as const;

      for (const [val, pos] of pairs) {
        const res = handleCodeBlockSmartBackspace({
          val,
          start: pos,
          end: pos,
        });

        expect(res).not.toBeNull();
        expect(res?.nextVal).toBe("");
        expect(res?.nextStart).toBe(0);
        expect(res?.nextEnd).toBe(0);
      }
    });

    it("returns null when selection is not collapsed", () => {
      const res = handleCodeBlockSmartBackspace({
        val: "  test",
        start: 0,
        end: 2,
      });

      expect(res).toBeNull();
    });
  });

  describe("handleCodeBlockTab", () => {
    it("inserts 2 spaces on Tab without selection", () => {
      const res = handleCodeBlockTab({
        val: "hello",
        start: 0,
        end: 0,
        shiftKey: false,
      });

      expect(res.nextVal).toBe("  hello");
      expect(res.nextStart).toBe(2);
      expect(res.nextEnd).toBe(2);
    });

    it("outdents 2 spaces on Shift+Tab for single line", () => {
      const res = handleCodeBlockTab({
        val: "  hello",
        start: 4,
        end: 4,
        shiftKey: true,
      });

      expect(res.nextVal).toBe("hello");
      expect(res.nextStart).toBe(2);
      expect(res.nextEnd).toBe(2);
    });

    it("outdents 1 space on Shift+Tab if line only had 1 space", () => {
      const res = handleCodeBlockTab({
        val: " hello",
        start: 3,
        end: 3,
        shiftKey: true,
      });

      expect(res.nextVal).toBe("hello");
      expect(res.nextStart).toBe(2);
      expect(res.nextEnd).toBe(2);
    });

    it("indents multiple lines when selection spans multiple lines", () => {
      const val = "line1\nline2\nline3";
      const res = handleCodeBlockTab({
        val,
        start: 0,
        end: val.length,
        shiftKey: false,
      });

      expect(res.nextVal).toBe("  line1\n  line2\n  line3");
      expect(res.nextStart).toBe(2);
      expect(res.nextEnd).toBe(val.length + 6);
    });

    it("outdents multiple lines on Shift+Tab across multi-line selection", () => {
      const val = "  line1\n  line2\n  line3";
      const res = handleCodeBlockTab({
        val,
        start: 0,
        end: val.length,
        shiftKey: true,
      });

      expect(res.nextVal).toBe("line1\nline2\nline3");
      expect(res.nextStart).toBe(0);
      expect(res.nextEnd).toBe(val.length - 6);
    });
  });
});
