import React from "react";
import { vi } from "vitest";

import { serializeAsJSON } from "../data/json";
import { Excalidraw } from "../index";
import { API } from "./helpers/api";
import { render, waitFor } from "./test-utils";

import type { ExcalidrawIframeElement } from "@excalidraw/element/types";

const { h } = window;

// PoC payload from issue #11930 — mirrors the exact structure an attacker
// would inject via scene update / collaboration.
const POC_HTML =
  `<script>window.__xss=1</script>` +
  `<iframe src="https://attacker.example"></iframe>`;

const createPoCIframeElement = (id = "poc-iframe"): ExcalidrawIframeElement => {
  const base = API.createElement({
    type: "iframe",
    id,
  }) as unknown as ExcalidrawIframeElement;
  return {
    ...base,
    customData: {
      generationData: {
        status: "done",
        html: POC_HTML,
      },
    },
  } as ExcalidrawIframeElement;
};

describe("iframe security", () => {
  // ------------------------------------------------------------------------
  // TEST 1 — Inject through scene update -> quarantine when validateIframe=false
  // ------------------------------------------------------------------------
  it("render block on scene update (validateIframe={false})", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await render(<Excalidraw validateIframe={false} />);

    const iframeEl = createPoCIframeElement();
    API.updateScene({ elements: [iframeEl] });

    await waitFor(() => {
      // (a) element is quarantined — marked isDeleted=true in the full scene
      const el = h.app.scene
        .getElementsIncludingDeleted()
        .find((e) => e.id === iframeEl.id);
      expect(el?.isDeleted).toBe(true);
    });

    // (b) NOT in non-deleted elements map
    const nonDeletedMap = h.app.scene.getNonDeletedElementsMap();
    expect(nonDeletedMap.has(iframeEl.id)).toBe(false);

    // (c) no iframe DOM nodes rendered (jsdom does create them for validated
    //     iframes — see probe-iframe.test.tsx)
    const iframeNodes = document.querySelectorAll("iframe.excalidraw__embeddable");
    expect(iframeNodes.length).toBe(0);

    warnSpy.mockRestore();
  });

  // ------------------------------------------------------------------------
  // TEST 2 — Collab-style repeated remote update; stays quarantined, no infinite loop
  // ------------------------------------------------------------------------
  it("collab-style remote update does not persist (validateIframe={false})", async () => {
    // Simulates what the collab layer does: remote scene updates arrive via
    // API.updateScene (same path handleRemoteSceneUpdate uses). The same
    // malicious iframe element is injected 3 times (simulating repeated
    // reconciliation cycles). It must stay quarantined each time and the
    // validation-cache bugfix must prevent a "Maximum update depth exceeded"
    // infinite loop.

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Attach a pageerror listener to catch React "Maximum update depth exceeded"
    const errors: string[] = [];
    const errorHandler = (e: ErrorEvent) => {
      errors.push(e.message || String(e.error));
    };
    window.addEventListener("error", errorHandler);

    await render(<Excalidraw validateIframe={false} />);

    const iframeEl = createPoCIframeElement("poc-collab-iframe");

    // Inject the same iframe 3 times, mimicking collab reconcile cycles
    for (let i = 0; i < 3; i++) {
      API.updateScene({ elements: [iframeEl] });

      // Each cycle: element must be quarantined (isDeleted=true)
      await waitFor(() => {
        const el = h.app.scene
          .getElementsIncludingDeleted()
          .find((e) => e.id === iframeEl.id);
        expect(el?.isDeleted).toBe(true);
      });

      // Non-deleted map must not contain it
      expect(h.app.scene.getNonDeletedElementsMap().has(iframeEl.id)).toBe(
        false,
      );
    }

    // No React infinite-loop errors should have fired
    expect(errors).toEqual([]);

    // No iframe DOM nodes rendered
    expect(document.querySelectorAll("iframe.excalidraw__embeddable").length).toBe(0);

    window.removeEventListener("error", errorHandler);
    warnSpy.mockRestore();
  });

  // ------------------------------------------------------------------------
  // TEST 3 — Remount with stricter prop quarantines previously-rendered iframe
  // ------------------------------------------------------------------------
  it("remount with stricter prop quarantines previously-rendered iframe", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Step 1: Mount with validateIframe={true} — PoC iframe passes validation
    const renderResult = await render(<Excalidraw validateIframe={true} />);

    const iframeEl = createPoCIframeElement("poc-remount-iframe");
    API.updateScene({ elements: [iframeEl] });

    // The iframe should NOT be deleted (validation passes with true)
    await waitFor(() => {
      const el = h.app.scene
        .getElementsIncludingDeleted()
        .find((e) => e.id === iframeEl.id);
      expect(el?.isDeleted).toBe(false);
    });

    // In jsdom a validated iframe creates a DOM node
    const iframeNodesBefore = document.querySelectorAll(
      "iframe.excalidraw__embeddable",
    );
    expect(iframeNodesBefore.length).toBe(1);

    // Step 2: Unmount
    renderResult.unmount();

    // Step 3: Re-mount with validateIframe={false} — stricter prop
    const renderResult2 = await render(<Excalidraw validateIframe={false} />);

    // Inject the SAME iframe element via scene update
    API.updateScene({ elements: [iframeEl] });

    // Now it should be quarantined (isDeleted=true) because validateIframe=false
    await waitFor(() => {
      const el = h.app.scene
        .getElementsIncludingDeleted()
        .find((e) => e.id === iframeEl.id);
      expect(el?.isDeleted).toBe(true);
    });

    // No iframe DOM nodes should be rendered
    expect(document.querySelectorAll("iframe.excalidraw__embeddable").length).toBe(0);

    // Non-deleted map must not contain it
    expect(h.app.scene.getNonDeletedElementsMap().has(iframeEl.id)).toBe(false);

    renderResult2.unmount();
    warnSpy.mockRestore();
  });

  // ------------------------------------------------------------------------
  // TEST 4 — Quarantined iframe does not leak into export JSON
  // ------------------------------------------------------------------------
  it("quarantined iframe does not leak into export", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await render(<Excalidraw validateIframe={false} />);

    const iframeEl = createPoCIframeElement("poc-export-iframe");
    API.updateScene({ elements: [iframeEl] });

    // Wait for quarantine
    await waitFor(() => {
      const el = h.app.scene
        .getElementsIncludingDeleted()
        .find((e) => e.id === iframeEl.id);
      expect(el?.isDeleted).toBe(true);
    });

    // Serialize the scene (h.elements = getElementsIncludingDeleted)
    const jsonStr = serializeAsJSON(
      h.elements,
      h.state,
      {},
      "local",
    );
    const parsed = JSON.parse(jsonStr);

    // The exported scene must contain the element (it's in the full scene)
    // but with isDeleted === true so loaders/importers skip it
    const exportedIframe = (parsed.elements as any[]).find(
      (el: any) => el.id === "poc-export-iframe",
    );
    expect(exportedIframe).toBeDefined();
    expect(exportedIframe.type).toBe("iframe");
    expect(exportedIframe.isDeleted).toBe(true);

    // Non-deleted elements array must NOT include the iframe
    // (serializeAsJSON passes h.elements which includes deleted, but
    //  importers filter on isDeleted — we verify the quarantine is correct)
    const nonDeletedFromScene = h.app.scene.getNonDeletedElements();
    expect(
      nonDeletedFromScene.find((e) => e.id === "poc-export-iframe"),
    ).toBeUndefined();

    warnSpy.mockRestore();
  });

  // ------------------------------------------------------------------------
  // TEST 5 — validateIframe unset (default): NO quarantine, NO infinite loop
  // ------------------------------------------------------------------------
  // Regression test for the "Maximum update depth exceeded" loop: when
  // validateIframe is not set, iframeValidator returns false but the element
  // is NOT quarantined (host hasn't opted in), so it stays in the non-deleted
  // view. Re-validating a `false` cache entry on every cycle would set
  // updated=true forever -> infinite React update loop. The guard must only
  // re-validate `false` entries when quarantine is actually possible
  // (validateIframe != null).
  it("unset validateIframe: iframe stays active, no infinite loop", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const errors: string[] = [];
    const errorHandler = (e: ErrorEvent) => {
      errors.push(e.message || String(e.error));
    };
    window.addEventListener("error", errorHandler);

    // No validateIframe prop — the default-block / TTD case
    await render(<Excalidraw />);

    const iframeEl = createPoCIframeElement("poc-unset-iframe");
    API.updateScene({ elements: [iframeEl] });

    // Give the update cycle time to settle. If the infinite-loop regression
    // exists, React throws "Maximum update depth exceeded" during this window
    // and the error lands in the listener below.
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Unset = no opt-in = NOT quarantined: element stays active (isDeleted
    // false) and present in the non-deleted map.
    const el = h.app.scene
      .getElementsIncludingDeleted()
      .find((e) => e.id === iframeEl.id);
    expect(el?.isDeleted).toBe(false);
    expect(h.app.scene.getNonDeletedElementsMap().has(iframeEl.id)).toBe(true);

    // No React infinite-loop errors must have fired
    expect(errors).toEqual([]);

    window.removeEventListener("error", errorHandler);
    warnSpy.mockRestore();
  });
});
