import { UI, Pointer } from "./helpers/ui";
import { API } from "./helpers/api";
import { render, fireEvent } from "./test-utils";
import { KEYS } from "@excalidraw/common";
import { Excalidraw } from "../index";

const { h } = window;

describe("自由画笔多点触控与手笔防误触测试", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  afterEach(() => {
    Pointer.resetAll();
  });

  it("当另一个 touch 指针按下时，应当废弃当前的自由画笔元素且在后续移动中阻断继续添加点", async () => {
    // 1. 选择自由画笔工具
    UI.clickTool("freedraw");

    // 2. 创建第一个 touch 指针进行绘制
    const touch1 = new Pointer("touch", 1);
    touch1.downAt(100, 100);
    touch1.moveTo(110, 110);
    touch1.moveTo(120, 120);

    // 此时应当有一个活动的自由画笔元素正在被绘制
    expect(h.state.newElement).not.toBeNull();
    expect(h.state.newElement?.type).toBe("freedraw");
    const firstElementId = h.state.newElement?.id;

    // 3. 模拟第二个 touch 指针按下（双指触控手势触发）
    const touch2 = new Pointer("touch", 2);
    touch2.downAt(300, 300);

    // 此时前一个自由画笔元素应当被拦截逻辑丢弃并清理，newElement 被重置为 null
    expect(h.state.newElement).toBeNull();
    expect(h.elements.some((el) => el.id === firstElementId)).toBe(false);

    // 4. 模拟第一个 touch 指针继续移动（此时已被多指针状态完全阻断）
    touch1.moveTo(130, 130);

    // 验证在多指针状态下，绝对不会有新的画笔元素被误创建或向其追加点
    expect(h.state.newElement).toBeNull();

    // 5. 模拟所有手指抬起
    touch1.up();
    touch2.up();
  });

  it("在已有自由画笔绘制过程中，当不同类型的指针（如 Touch 手掌与 Pen 触控笔）同时发生时，应当防止在它们之间拉出大直线", async () => {
    // 1. 选择自由画笔工具
    UI.clickTool("freedraw");

    // 2. 模拟手掌（touch）首先触下
    const touch = new Pointer("touch", 1);
    touch.downAt(50, 50);
    touch.moveTo(60, 60);

    expect(h.state.newElement).not.toBeNull();
    const palmElementId = h.state.newElement?.id;

    // 3. 模拟电磁笔（pen）随后触下（触发手笔防误触）
    const pen = new Pointer("pen", 2);
    pen.downAt(200, 200);

    // 此时前一个因手掌误触产生的画笔应当被安全丢弃，newElement 置为 null
    expect(h.state.newElement).toBeNull();
    expect(h.elements.some((el) => el.id === palmElementId)).toBe(false);

    // 4. 模拟电磁笔指针继续移动
    pen.moveTo(210, 210);

    // 验证此时不应当继续误绘制任何带有笔尖到手掌瞬移跨度的长直线或折线
    expect(h.state.newElement).toBeNull();

    // 5. 释放指针
    pen.up();
    touch.up();
  });
});
