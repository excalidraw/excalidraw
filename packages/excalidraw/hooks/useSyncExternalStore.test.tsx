import { act, render } from "@testing-library/react";

import { useSyncExternalStorePolyfill } from "./useSyncExternalStore";

describe("useSyncExternalStore for React 17", () => {
  it("follows the store, also a change landing before it subscribed", () => {
    let value = "a";
    const listeners = new Set<() => void>();
    const subscribe = (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };
    const Reader = () => {
      const snapshot = useSyncExternalStorePolyfill(subscribe, () => value);
      // changes after this render, before the effect subscribes
      if (value === "a") {
        value = "b";
      }
      return <span>{snapshot}</span>;
    };

    const { container, unmount } = render(<Reader />);
    expect(container.textContent).toBe("b");

    act(() => {
      value = "c";
      listeners.forEach((listener) => listener());
    });
    expect(container.textContent).toBe("c");

    unmount();
    expect(listeners.size).toBe(0);
  });
});
