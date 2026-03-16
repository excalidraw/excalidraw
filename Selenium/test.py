import os
import math
import random
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

from selenium import webdriver
from selenium.webdriver import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.edge.options import Options as EdgeOptions
from selenium.webdriver.edge.service import Service
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from selenium.common.exceptions import NoSuchWindowException


def create_edge_driver() -> webdriver.Edge:
    options = EdgeOptions()
    options.add_argument("start-maximized")
    if os.environ.get("SELENIUM_HEADLESS") == "1":
        options.add_argument("--headless=new")
        options.add_argument("--disable-gpu")
        options.add_argument("window-size=1280,720")

    edge_driver_path = os.environ.get("EDGEWEBDRIVER") or os.environ.get("MS_EDGEWEBDRIVER")
    if edge_driver_path:
        service = Service(executable_path=edge_driver_path)
        return webdriver.Edge(service=service, options=options)

    return webdriver.Edge(options=options)


def wait_for_page_ready(driver: webdriver.Edge, timeout_s: int = 30) -> None:
    WebDriverWait(driver, timeout_s).until(
        lambda d: d.execute_script("return document.readyState") == "complete"
    )
    WebDriverWait(driver, timeout_s).until(EC.presence_of_element_located((By.TAG_NAME, "body")))


def wait_for_http_ready(url: str, timeout_s: int = 120) -> None:
    deadline = time.time() + float(timeout_s)
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            with urlopen(url, timeout=5) as resp:
                status = getattr(resp, "status", None)
                if status and 200 <= int(status) < 500:
                    return
        except URLError as e:
            last_error = e
        except Exception as e:
            last_error = e
        time.sleep(1)
    if last_error:
        raise last_error
    raise TimeoutError(f"Server not ready: {url}")

def percentile(values: list[float], p: float) -> float:
    if not values:
        return float("nan")
    sorted_values = sorted(values)
    clamped = min(1.0, max(0.0, float(p)))
    idx = int(math.ceil(clamped * len(sorted_values)) - 1)
    idx = max(0, min(len(sorted_values) - 1, idx))
    return float(sorted_values[idx])


def generate_random_text(seed: int, length: int) -> str:
    rng = random.Random(seed)
    alphabet = (
        "abcdefghijklmnopqrstuvwxyz"
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        "0123456789"
        "     "
        ".,;:!?-_/()[]{}<>"
        "~@#$%^&*+=|"
        "你好世界随机文本"
    )
    return "".join(rng.choice(alphabet) for _ in range(int(length)))


def generate_random_text_with_newlines(seed: int, length: int) -> str:
    rng = random.Random(seed)
    base = generate_random_text(seed, int(length))
    chars: list[str] = []
    for ch in base:
        if ch != "\n" and rng.random() < 0.015:
            chars.append("\n")
        else:
            chars.append(ch)
    value = "".join(chars)
    if len(value) > int(length):
        value = value[: int(length)]
    if len(value) < int(length):
        value = value + generate_random_text(seed + 1, int(length) - len(value))
    return value


def get_canvas(driver: webdriver.Edge):
    canvas = WebDriverWait(driver, 30).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "canvas.interactive"))
    )
    WebDriverWait(driver, 30).until(
        lambda d: bool(
            d.execute_script(
                """
                const c = document.querySelector("canvas.interactive");
                if (!c) return false;
                const r = c.getBoundingClientRect();
                return r.width > 50 && r.height > 50;
                """
            )
        )
    )
    return canvas


def get_canvas_rect(driver: webdriver.Edge) -> dict:
    return driver.execute_script(
        """
        const c = document.querySelector("canvas.interactive");
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return {left: r.left, top: r.top, width: r.width, height: r.height};
        """
    )


def wait_for_textarea(driver: webdriver.Edge, timeout_s: int = 30):
    return WebDriverWait(driver, timeout_s).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "textarea.excalidraw-wysiwyg"))
    )


def textarea_box(driver: webdriver.Edge) -> dict:
    return driver.execute_script(
        """
        const t = document.querySelector("textarea.excalidraw-wysiwyg");
        if (!t) return null;
        const r = t.getBoundingClientRect();
        return {x: r.x, y: r.y, width: r.width, height: r.height};
        """
    )


def ensure_selection_tool(driver: webdriver.Edge) -> None:
    body = driver.find_element(By.TAG_NAME, "body")
    body.send_keys("v")


def ensure_text_tool(driver: webdriver.Edge) -> None:
    body = driver.find_element(By.TAG_NAME, "body")
    body.send_keys("t")


def canvas_centered_offset(
    driver: webdriver.Edge, canvas, x_from_left: float, y_from_top: float
) -> tuple[int, int]:
    rect = driver.execute_script(
        """
        const el = arguments[0];
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { width: r.width, height: r.height };
        """,
        canvas,
    )
    width = int(round(float((rect or {}).get("width") or 0)))
    height = int(round(float((rect or {}).get("height") or 0)))
    if width <= 0 or height <= 0:
        size = canvas.size or {}
        width = int(size.get("width") or 0)
        height = int(size.get("height") or 0)
    cx = int(round(float(x_from_left)))
    cy = int(round(float(y_from_top)))
    if width > 2:
        cx = max(1, min(width - 2, cx))
    if height > 2:
        cy = max(1, min(height - 2, cy))
    ox = cx - int(round(width / 2))
    oy = cy - int(round(height / 2))
    if width > 2:
        ox = max(-int(round(width / 2)) + 1, min(int(round(width / 2)) - 1, ox))
    if height > 2:
        oy = max(-int(round(height / 2)) + 1, min(int(round(height / 2)) - 1, oy))
    return ox, oy


def click_canvas(driver: webdriver.Edge, x: float, y: float) -> None:
    canvas = get_canvas(driver)
    ox, oy = canvas_centered_offset(driver, canvas, x, y)
    ActionChains(driver).move_to_element_with_offset(canvas, ox, oy).click().perform()


def dblclick_canvas(driver: webdriver.Edge, x: float, y: float) -> None:
    canvas = get_canvas(driver)
    ox, oy = canvas_centered_offset(driver, canvas, x, y)
    ActionChains(driver).move_to_element_with_offset(canvas, ox, oy).double_click().perform()


def open_text_editor_at(driver: webdriver.Edge, x: float, y: float):
    ensure_text_tool(driver)
    click_canvas(driver, x, y)
    return wait_for_textarea(driver, timeout_s=30)


def open_editor_by_double_click_at(driver: webdriver.Edge, x: float, y: float):
    ensure_selection_tool(driver)
    dblclick_canvas(driver, x, y)
    return wait_for_textarea(driver, timeout_s=30)


def exit_editor(driver: webdriver.Edge) -> None:
    try:
        ActionChains(driver).send_keys(Keys.ESCAPE).perform()
        WebDriverWait(driver, 30).until_not(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, "textarea.excalidraw-wysiwyg")
            )
        )
        return
    except NoSuchWindowException:
        raise
    except Exception:
        pass

    try:
        rect = get_canvas_rect(driver)
        if rect:
            click_canvas(driver, 10, 10)
        ActionChains(driver).send_keys(Keys.ESCAPE).perform()
        WebDriverWait(driver, 30).until_not(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, "textarea.excalidraw-wysiwyg")
            )
        )
    except NoSuchWindowException:
        raise


def set_textarea_value(driver: webdriver.Edge, value: str) -> None:
    driver.execute_script(
        """
        const value = arguments[0];
        const t = document.querySelector("textarea.excalidraw-wysiwyg");
        if (!t) throw new Error("missing textarea");
        t.value = String(value);
        t.dispatchEvent(new Event("input", { bubbles: true }));
        """,
        value,
    )
    WebDriverWait(driver, 60).until(
        lambda d: int(
            d.execute_script(
                """
                const t = document.querySelector("textarea.excalidraw-wysiwyg");
                return t ? t.value.length : -1;
                """
            )
        )
        == len(value)
    )


def drag_resize_from_right_to_width(
    driver: webdriver.Edge, editor_box: dict, target_width: float
) -> None:
    canvas_rect = get_canvas_rect(driver)
    if not canvas_rect:
        raise RuntimeError("missing canvas rect")

    ensure_selection_tool(driver)

    center_x = editor_box["x"] + editor_box["width"] / 2
    center_y = editor_box["y"] + editor_box["height"] / 2

    click_canvas(driver, center_x - canvas_rect["left"], center_y - canvas_rect["top"])

    start_x = editor_box["x"] + editor_box["width"] - 1
    start_y = editor_box["y"] + editor_box["height"] / 2
    delta_x = float(target_width) - float(editor_box["width"])

    canvas = get_canvas(driver)
    actions = ActionChains(driver)
    start_ox, start_oy = canvas_centered_offset(
        driver, canvas, start_x - canvas_rect["left"], start_y - canvas_rect["top"]
    )
    actions.move_to_element_with_offset(canvas, start_ox, start_oy)
    actions.click_and_hold()
    actions.move_by_offset(delta_x, 0)
    actions.release()
    actions.perform()

    time.sleep(0.1)


def get_viewport_center_canvas_offset(driver: webdriver.Edge) -> tuple[float, float]:
    result = driver.execute_script(
        """
        const canvas = document.querySelector("canvas.interactive");
        if (!canvas) return null;
        const r = canvas.getBoundingClientRect();
        const cx = window.innerWidth / 2 - r.left;
        const cy = window.innerHeight / 2 - r.top;
        return { x: cx, y: cy };
        """
    )
    if not result:
        raise RuntimeError("missing canvas")
    return float(result["x"]), float(result["y"])


def pan_canvas_by_space_drag(driver: webdriver.Edge, dx: float, dy: float) -> None:
    canvas = get_canvas(driver)
    max_step = 250.0
    steps = int(max(abs(dx), abs(dy)) // max_step) + 1
    for i in range(steps):
        step_dx = dx / steps
        step_dy = dy / steps
        actions = ActionChains(driver)
        actions.key_down(Keys.SPACE)
        actions.move_to_element(canvas)
        actions.click_and_hold()
        actions.move_by_offset(step_dx, step_dy)
        actions.release()
        actions.key_up(Keys.SPACE)
        actions.perform()
        time.sleep(0.05)


def scroll_canvas_wheel_ticks(driver: webdriver.Edge, ticks: int, delta_y_per_tick: int = 120) -> None:
    canvas = get_canvas(driver)
    delta = int(delta_y_per_tick)
    count = int(ticks)
    if count <= 0:
        return
    for _ in range(count):
        actions = ActionChains(driver)
        actions.move_to_element(canvas)
        if hasattr(actions, "scroll_by_amount"):
            actions.scroll_by_amount(0, delta)
            actions.perform()
        else:
            driver.execute_script(
                """
                const deltaY = arguments[0];
                const canvas = document.querySelector("canvas.interactive");
                if (!canvas) throw new Error("missing canvas");
                canvas.dispatchEvent(new WheelEvent("wheel", {
                  deltaY,
                  deltaX: 0,
                  bubbles: true,
                  cancelable: true,
                }));
                """,
                delta,
            )
        time.sleep(0.02)
    time.sleep(0.2)


def pan_canvas_to_center_textbox(driver: webdriver.Edge, textbox_box: dict) -> None:
    canvas_rect = get_canvas_rect(driver)
    if not canvas_rect:
        raise RuntimeError("missing canvas rect")
    center_x = float(textbox_box["x"]) + float(textbox_box["width"]) / 2
    center_y = float(textbox_box["y"]) + float(textbox_box["height"]) / 2
    target_x = float(canvas_rect["left"]) + float(canvas_rect["width"]) / 2
    target_y = float(canvas_rect["top"]) + float(canvas_rect["height"]) / 2
    dx = target_x - center_x
    dy = target_y - center_y
    pan_canvas_by_space_drag(driver, dx, dy)


def measure_long_text_editing_latency_ms(driver: webdriver.Edge) -> float:
    return float(
        driver.execute_async_script(
            """
            const done = arguments[arguments.length - 1];
            const t = document.querySelector("textarea.excalidraw-wysiwyg");
            if (!t) { done({error: "missing textarea"}); return; }
            t.selectionStart = t.selectionEnd = t.value.length;
            const t0 = performance.now();
            t.dispatchEvent(new KeyboardEvent("keydown", { key: "x", bubbles: true }));
            t.value += "x";
            t.dispatchEvent(new Event("input", { bubbles: true }));

            let stable = 0;
            let last = null;
            const start = performance.now();
            const loop = () => {
              if (performance.now() - start > 20000) { done({error: "timeout"}); return; }
              const r = t.getBoundingClientRect();
              const cur = [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10).join(",");
              if (cur === last) stable += 1;
              else stable = 0;
              last = cur;
              if (stable >= 2) { done({dt: performance.now() - t0}); return; }
              requestAnimationFrame(loop);
            };
            requestAnimationFrame(loop);
            """
        )["dt"]
    )


def measure_alt_move_line_latency_ms(driver: webdriver.Edge, direction: str) -> float:
    result = driver.execute_async_script(
        """
        const direction = arguments[0];
        const done = arguments[arguments.length - 1];
        const t = document.querySelector("textarea.excalidraw-wysiwyg");
        if (!t) { done({error: "missing textarea"}); return; }
        const beforeValue = t.value;
        const beforeStart = t.selectionStart;
        const beforeEnd = t.selectionEnd;
        const t0 = performance.now();
        t.dispatchEvent(new KeyboardEvent("keydown", {
          key: direction,
          altKey: true,
          bubbles: true,
          cancelable: true,
        }));

        let stable = 0;
        let last = null;
        const start = performance.now();
        const loop = () => {
          if (performance.now() - start > 20000) { done({error: "timeout"}); return; }
          const changed = t.value !== beforeValue || t.selectionStart !== beforeStart || t.selectionEnd !== beforeEnd;
          if (!changed) { requestAnimationFrame(loop); return; }
          const r = t.getBoundingClientRect();
          const cur = [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10).join(",");
          if (cur === last) stable += 1;
          else stable = 0;
          last = cur;
          if (stable >= 2) { done({dt: performance.now() - t0}); return; }
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
        """,
        direction,
    )
    if "error" in result:
        raise RuntimeError(f"alt move line failed: {result}")
    return float(result["dt"])


def install_dblclick_response_speed_hook(driver: webdriver.Edge) -> None:
    driver.execute_script(
        """
        window.__seleniumDblClickResponseSpeed = { seq: 0, completedSeq: 0, latencyMs: 0 };
        if (window.__seleniumDblClickResponseSpeedInstalled) return;
        window.__seleniumDblClickResponseSpeedInstalled = true;
        document.addEventListener("dblclick", () => {
          const s = window.__seleniumDblClickResponseSpeed;
          s.seq += 1;
          const activeSeq = s.seq;
          const t0 = performance.now();
          const loop = () => {
            const t = document.querySelector("textarea.excalidraw-wysiwyg");
            if (t && document.activeElement === t && (t.selectionEnd ?? 0) > 0) {
              s.latencyMs = performance.now() - t0;
              s.completedSeq = activeSeq;
              return;
            }
            requestAnimationFrame(loop);
          };
          requestAnimationFrame(loop);
        }, { capture: true });
        """
    )


def wait_for_hook_completed_seq(driver: webdriver.Edge, seq: int, timeout_s: int = 30) -> None:
    WebDriverWait(driver, timeout_s).until(
        lambda d: int(
            d.execute_script(
                "return Number(window.__seleniumDblClickResponseSpeed?.completedSeq ?? 0)"
            )
        )
        == int(seq)
    )


def read_hook_latency_ms(driver: webdriver.Edge) -> float:
    return float(
        driver.execute_script(
            "return Number(window.__seleniumDblClickResponseSpeed?.latencyMs ?? NaN)"
        )
    )


def run_response_speed_tests(driver: webdriver.Edge, url: str) -> None:
    print(f"[selenium] url={url}")
    wait_for_http_ready(url, timeout_s=5)
    print("[selenium] http ready")
    driver.get(url)
    wait_for_page_ready(driver, timeout_s=60)
    get_canvas(driver)
    print("[selenium] page ready")

    create_x, create_y = get_viewport_center_canvas_offset(driver)
    target_width = 300

    install_dblclick_response_speed_hook(driver)

    def run_operation_a(label: str) -> None:
        seed = 424242 if label == "A" else 424242 + 1

        open_text_editor_at(driver, create_x, create_y)
        base = generate_random_text_with_newlines(seed, 50_000)
        set_textarea_value(driver, base)
        exit_editor(driver)
        print(f"[selenium] op{label}: prepared text element")

        open_editor_by_double_click_at(driver, create_x, create_y)
        base_box = textarea_box(driver)
        if not base_box:
            raise RuntimeError("missing textarea box")
        exit_editor(driver)

        drag_resize_from_right_to_width(driver, base_box, target_width)
        print(f"[selenium] op{label}: resized to width={target_width}")

        open_editor_by_double_click_at(driver, create_x, create_y)
        after_resize_box = textarea_box(driver)
        if not after_resize_box:
            raise RuntimeError("missing textarea box")
        exit_editor(driver)

        pan_canvas_to_center_textbox(driver, after_resize_box)
        print(f"[selenium] op{label}: panned canvas to center textbox")

        cx, cy = get_viewport_center_canvas_offset(driver)
        open_editor_by_double_click_at(driver, cx, cy)
        latencies = [measure_long_text_editing_latency_ms(driver) for _ in range(5)]
        exit_editor(driver)

        p50 = percentile(latencies, 0.5)
        p95 = percentile(latencies, 0.95)
        mx = max(latencies)
        print(
            f"[response speed][selenium][op{label}] long text editing: p50={p50:.1f}ms p95={p95:.1f}ms max={mx:.1f}ms n={len(latencies)}"
        )

        open_editor_by_double_click_at(driver, cx, cy)
        driver.execute_script(
            """
            const t = document.querySelector("textarea.excalidraw-wysiwyg");
            if (!t) throw new Error("missing textarea");
            let idx = Math.floor(t.value.length / 2);
            if (t.value[idx] === "\\n") idx += 1;
            idx = Math.max(1, Math.min(idx, t.value.length - 1));
            t.selectionStart = t.selectionEnd = idx;
            """
        )
        latencies2: list[float] = []
        for i in range(10):
            direction = "ArrowUp" if i % 2 == 0 else "ArrowDown"
            latencies2.append(measure_alt_move_line_latency_ms(driver, direction))
        exit_editor(driver)

        p50 = percentile(latencies2, 0.5)
        p95 = percentile(latencies2, 0.95)
        mx = max(latencies2)
        print(
            f"[response speed][selenium][op{label}] Alt+ArrowUp/Down move line: p50={p50:.1f}ms p95={p95:.1f}ms max={mx:.1f}ms n={len(latencies2)}"
        )

        latencies3: list[float] = []
        for _ in range(5):
            ensure_selection_tool(driver)
            expected_seq = int(
                driver.execute_script(
                    "return Number(window.__seleniumDblClickResponseSpeed?.seq ?? 0) + 1"
                )
            )
            dblclick_canvas(driver, cx, cy)
            wait_for_hook_completed_seq(driver, expected_seq, timeout_s=60)
            wait_for_textarea(driver, timeout_s=30)
            latencies3.append(read_hook_latency_ms(driver))
            exit_editor(driver)

        p50 = percentile(latencies3, 0.5)
        p95 = percentile(latencies3, 0.95)
        mx = max(latencies3)
        print(
            f"[response speed][selenium][op{label}] double click inserts caret: p50={p50:.1f}ms p95={p95:.1f}ms max={mx:.1f}ms n={len(latencies3)}"
        )

    run_operation_a("A")
    for i in range(3):
        print(f"[selenium] opB{i+1}: wheel down 20 ticks and repeat opA")
        scroll_canvas_wheel_ticks(driver, 20, delta_y_per_tick=120)
        run_operation_a(f"B{i+1}")


if __name__ == "__main__":
    url = os.environ.get("EXCALIDRAW_URL", "http://localhost:3000")
    driver = create_edge_driver()
    driver.set_page_load_timeout(120)
    driver.set_script_timeout(900)
    try:
        run_response_speed_tests(driver, url)
    except Exception:
        screenshot_path = Path(__file__).with_name("selenium_failure.png")
        try:
            try:
                driver.save_screenshot(str(screenshot_path))
                print("已保存失败截图:", str(screenshot_path))
            except NoSuchWindowException:
                pass
        finally:
            raise
    finally:
        try:
            driver.quit()
        except Exception:
            pass
















