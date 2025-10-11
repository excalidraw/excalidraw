export function detectTouchDevice(): boolean {
  return (
    typeof window !== "undefined" &&
    ("ontouchstart" in window ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
      (window.navigator as any).msMaxTouchPoints > 0)
  );
}