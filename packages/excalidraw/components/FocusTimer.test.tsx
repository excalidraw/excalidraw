import { fireEvent, screen, waitFor } from "@testing-library/react";

import { Excalidraw } from "../index";

import {
  clampCustomHours,
  clampCustomMinutes,
  formatRemainingMs,
  resolveCustomDurationMinutes,
} from "./FocusTimer";

import { render, unmountComponent } from "../tests/test-utils";

unmountComponent();

describe("FocusTimer helpers", () => {
  it("formats remaining milliseconds as MM:SS", () => {
    expect(formatRemainingMs(0)).toBe("00:00");
    expect(formatRemainingMs(59000)).toBe("00:59");
    expect(formatRemainingMs(60000)).toBe("01:00");
    expect(formatRemainingMs(125000)).toBe("02:05");
  });

  it("formats hour-long durations as H:MM:SS", () => {
    expect(formatRemainingMs(3_600_000)).toBe("1:00:00");
    expect(formatRemainingMs(7_500_000)).toBe("2:05:00");
  });

  it("clamps custom minutes to 1–180", () => {
    expect(clampCustomMinutes(0)).toBe(1);
    expect(clampCustomMinutes(0.4)).toBe(1);
    expect(clampCustomMinutes(5.6)).toBe(6);
    expect(clampCustomMinutes(999)).toBe(180);
    expect(clampCustomMinutes(Number.NaN)).toBe(1);
  });

  it("clamps custom hours to 1–8", () => {
    expect(clampCustomHours(0)).toBe(1);
    expect(clampCustomHours(2.4)).toBe(2);
    expect(clampCustomHours(12)).toBe(8);
    expect(clampCustomHours(Number.NaN)).toBe(1);
  });

  it("resolves custom duration by unit into minutes", () => {
    expect(resolveCustomDurationMinutes(2, "hours")).toBe(120);
    expect(resolveCustomDurationMinutes(3, "minutes")).toBe(3);
  });
});

describe("FocusTimer", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const openTimer = () => {
    fireEvent.click(screen.getByTestId("focus-timer-button"));
  };

  it("starts from a preset and shows a running badge", () => {
    openTimer();
    fireEvent.click(screen.getByTestId("focus-timer-preset-1"));
    fireEvent.click(screen.getByTestId("focus-timer-start"));

    expect(screen.getByTestId("focus-timer-badge")).toHaveTextContent("01:00");
    expect(screen.getByTestId("focus-timer-display")).toHaveTextContent("01:00");
    expect(screen.queryByTestId("focus-timer-start")).not.toBeInTheDocument();
  });

  it("uses a custom duration in minutes when provided", () => {
    openTimer();
    fireEvent.change(screen.getByTestId("focus-timer-custom-duration"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByTestId("focus-timer-start"));

    expect(screen.getByTestId("focus-timer-display")).toHaveTextContent("03:00");
  });

  it("uses a custom duration in hours when provided", () => {
    openTimer();
    fireEvent.click(screen.getByTestId("focus-timer-unit-hours"));
    fireEvent.change(screen.getByTestId("focus-timer-custom-duration"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByTestId("focus-timer-start"));

    expect(screen.getByTestId("focus-timer-display")).toHaveTextContent(
      "2:00:00",
    );
  });

  it("clamps custom duration above 180 minutes", () => {
    openTimer();
    fireEvent.change(screen.getByTestId("focus-timer-custom-duration"), {
      target: { value: "200" },
    });
    fireEvent.click(screen.getByTestId("focus-timer-start"));

    expect(screen.getByTestId("focus-timer-display")).toHaveTextContent(
      "3:00:00",
    );
  });

  it("supports pause and resume", () => {
    const startTime = new Date("2026-01-01T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(startTime);

    openTimer();
    fireEvent.click(screen.getByTestId("focus-timer-start"));

    vi.setSystemTime(new Date(startTime.getTime() + 15_000));
    fireEvent.click(screen.getByTestId("focus-timer-pause"));
    expect(screen.getByTestId("focus-timer-display")).toHaveTextContent("04:45");

    vi.setSystemTime(new Date(startTime.getTime() + 75_000));
    expect(screen.getByTestId("focus-timer-display")).toHaveTextContent("04:45");

    fireEvent.click(screen.getByTestId("focus-timer-resume"));
    expect(screen.getByTestId("focus-timer-pause")).toBeInTheDocument();
    expect(screen.getByTestId("focus-timer-display")).toHaveTextContent("04:45");
  });

  it("expires with toast and reset returns to idle", async () => {
    vi.useFakeTimers();
    openTimer();
    fireEvent.click(screen.getByTestId("focus-timer-preset-1"));
    fireEvent.click(screen.getByTestId("focus-timer-start"));

    vi.advanceTimersByTime(60_000);

    await waitFor(() => {
      expect(screen.getByTestId("focus-timer-expired")).toBeInTheDocument();
    });
    expect(screen.getByText("Workshop timer finished")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("focus-timer-reset"));
    expect(screen.queryByTestId("focus-timer-display")).not.toBeInTheDocument();
    expect(screen.getByTestId("focus-timer-start")).toBeInTheDocument();
  });

  it("does not allow starting a second countdown while one is active", () => {
    openTimer();
    fireEvent.click(screen.getByTestId("focus-timer-preset-1"));
    fireEvent.click(screen.getByTestId("focus-timer-start"));

    expect(screen.queryByTestId("focus-timer-start")).not.toBeInTheDocument();
    expect(screen.queryByTestId("focus-timer-preset-1")).not.toBeInTheDocument();
  });
});
