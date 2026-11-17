import React from "react";

import { API } from "./helpers/api";
import { act, fireEvent, render, waitFor } from "./test-utils";
import { Excalidraw } from "../index";

const { h } = window;

const openDialog = (elementId: string) => {
  act(() => {
    h.app.setState({
      openDialog: { name: "elementLinkSelector", sourceElementId: elementId },
    });
  });
};

const findLookupToggle = () =>
  document.querySelector<HTMLButtonElement>(".LinkLookup__toggle");

const findLookupField = () =>
  document.querySelector<HTMLInputElement>(".LinkLookup__field input");

const findResults = () =>
  [
    ...document.querySelectorAll<HTMLButtonElement>(".LinkLookup__result"),
  ];

const findLinkField = () =>
  document.querySelector<HTMLInputElement>(
    ".ElementLinkDialog__input-field input",
  );

const submitLookup = async (query: string) => {
  const field = await waitFor(() => {
    const input = findLookupField();
    expect(input).not.toBeNull();
    return input!;
  });
  fireEvent.change(field, { target: { value: query } });
  fireEvent.keyDown(field, { key: "Enter" });
};

describe("ElementLinkDialog public link lookup", () => {
  it("does not render the lookup action when onLinkLookup is not provided", async () => {
    const element = API.createElement({ type: "rectangle" });
    await render(<Excalidraw initialData={{ elements: [element] }} />);
    openDialog(element.id);

    expect(document.querySelector(".ElementLinkDialog")).not.toBeNull();
    expect(findLookupToggle()).toBeNull();
  });

  it("looks up on explicit submission and saves the chosen url through the link flow", async () => {
    const element = API.createElement({ type: "rectangle" });
    const onLinkLookup = vi.fn(async (query: string) => {
      expect(query).toBe("gateway api docs");
      return [
        { title: "Gateway API", url: "https://gateway-api.sigs.k8s.io/" },
      ];
    });
    await render(
      <Excalidraw
        initialData={{ elements: [element] }}
        onLinkLookup={onLinkLookup}
      />,
    );
    openDialog(element.id);

    // action is shown only when the callback is configured
    expect(findLookupToggle()).not.toBeNull();
    fireEvent.click(findLookupToggle()!);

    // lookup must not run until explicitly submitted
    expect(onLinkLookup).not.toHaveBeenCalled();

    await submitLookup("gateway api docs");

    const results = await waitFor(() => {
      expect(findResults().length).toBe(1);
      return findResults();
    });

    fireEvent.click(results[0]);

    expect(findLinkField()!.value).toBe("https://gateway-api.sigs.k8s.io/");

    fireEvent.click(
      [...document.querySelectorAll(".ElementLinkDialog button")].find(
        (b) => b.textContent === "Confirm",
      ) ?? document.body,
    );
    await waitFor(() => {
      expect(
        h.app.scene.getNonDeletedElementsMap().get(element.id)!.link,
      ).toBe("https://gateway-api.sigs.k8s.io/");
    });
  });

  it("filters out results that are not absolute http(s) urls", async () => {
    const element = API.createElement({ type: "rectangle" });
    const onLinkLookup = vi.fn(async () => [
      { title: "good", url: "https://example.com/docs" },
      { title: "relative", url: "/docs" },
      { title: "js", url: "javascript:alert(1)" },
      { title: "ftp", url: "ftp://example.com/file" },
      { title: "garbage", url: "not a url" },
      { title: "no url", url: undefined as unknown as string },
    ]);
    await render(
      <Excalidraw
        initialData={{ elements: [element] }}
        onLinkLookup={onLinkLookup}
      />,
    );
    openDialog(element.id);
    fireEvent.click(findLookupToggle()!);
    await submitLookup("anything");

    await waitFor(() => {
      expect(findResults().length).toBe(1);
    });
    expect(findResults()[0].textContent).toContain("https://example.com/docs");
  });

  it("aborts the pending lookup when the dialog closes", async () => {
    const element = API.createElement({ type: "rectangle" });
    const signals: AbortSignal[] = [];
    const onLinkLookup = vi.fn(
      (_query: string, { signal }: { signal: AbortSignal }) => {
        signals.push(signal);
        return new Promise(() => {
          /* never resolves */
        });
      },
    );
    await render(
      <Excalidraw
        initialData={{ elements: [element] }}
        onLinkLookup={onLinkLookup}
      />,
    );
    openDialog(element.id);
    fireEvent.click(findLookupToggle()!);
    await submitLookup("query");

    await waitFor(() => expect(onLinkLookup).toHaveBeenCalledTimes(1));

    fireEvent.click(
      [...document.querySelectorAll(".ElementLinkDialog button")].find(
        (b) => b.textContent === "Cancel",
      )!,
    );
    await waitFor(() => {
      expect(signals[0].aborted).toBe(true);
    });
  });

  it("offers the lookup in the hyperlink popup editor", async () => {
    const element = API.createElement({ type: "rectangle" });
    const onLinkLookup = vi.fn(async () => [
      { title: "Docs", url: "https://example.com/docs" },
    ]);
    await render(
      <Excalidraw
        initialData={{ elements: [element] }}
        onLinkLookup={onLinkLookup}
      />,
    );
    act(() => {
      h.app.setState({
        selectedElementIds: { [element.id]: true },
        showHyperlinkPopup: "editor",
      });
    });

    // the popup editor offers the lookup; picking fills its input
    const popup = document.querySelector(".excalidraw-hyperlinkContainer");
    if (!popup || !popup.querySelector("input")) {
      throw new Error(
        `popup bad; containers=${document.querySelectorAll(
          ".excalidraw-hyperlinkContainer",
        ).length} html=${popup?.innerHTML?.slice(0, 300) ?? "null"}`,
      );
    }
    fireEvent.click(document.querySelector(".LinkLookup__toggle")!);
    await submitLookup("k8s gateway");
    fireEvent.click(
      (await waitFor(() => {
        expect(findResults().length).toBeGreaterThan(0);
        return findResults();
      }))[0],
    );

    const popupInput = document.querySelector<HTMLInputElement>(
      ".excalidraw-hyperlinkContainer-input",
    );
    expect(popupInput!.value).toBe("https://example.com/docs");
  });

  it("ignores stale results when a newer lookup has started", async () => {
    const element = API.createElement({ type: "rectangle" });
    const resolvers: Array<{
      resolve: (results: { title: string; url: string }[]) => void;
    }> = [];
    const onLinkLookup = vi.fn(
      (query: string, _opts: { signal: AbortSignal }) => {
        const { promise, resolve } = Promise.withResolvers<
          { title: string; url: string }[]
        >();
        resolvers.push({ resolve });
        return promise;
      },
    );
    await render(
      <Excalidraw
        initialData={{ elements: [element] }}
        onLinkLookup={onLinkLookup}
      />,
    );
    openDialog(element.id);
    fireEvent.click(findLookupToggle()!);
    await submitLookup("first");
    await waitFor(() => expect(onLinkLookup).toHaveBeenCalledTimes(1));

    await submitLookup("second");
    await waitFor(() => expect(onLinkLookup).toHaveBeenCalledTimes(2));

    // resolve the first (stale) lookup first
    resolvers[0].resolve([{ title: "stale", url: "https://stale.example.com/" }]);
    await new Promise((r) => setTimeout(r, 50));
    // stale results must not be shown
    expect(findResults().length).toBe(0);

    resolvers[1].resolve([{ title: "fresh", url: "https://fresh.example.com/" }]);
    await waitFor(() => {
      expect(findResults().length).toBe(1);
    });
    expect(findResults()[0].textContent).toContain("fresh");
  });
});
