// Utility to detect touch or stylus device

export function detectTouchDevice(): boolean {
  // Check if the device supports touch or stylus pointer events
  return (
    typeof window !== "undefined" &&
    ("ontouchstart" in window ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
      (window.navigator as any).msMaxTouchPoints > 0)
  );
}
