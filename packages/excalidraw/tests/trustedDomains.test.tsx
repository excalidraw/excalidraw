import React from "react";

import { reseed } from "@excalidraw/common";
import { setDateTimeForTests } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Pointer, UI } from "./helpers/ui";
import {
  fireEvent,
  GlobalTestState,
  mockBoundingClientRect,
  queryByText,
  render,
  restoreOriginalGetBoundingClientRect,
  screen,
  unmountComponent,
  waitFor,
} from "./test-utils";

const { h } = window;

describe("trusted domains", () => {
  const mouse = new Pointer("mouse");

  beforeAll(() => {
    mockBoundingClientRect();
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  beforeEach(async () => {
    localStorage.clear();
    reseed(7);
    setDateTimeForTests("201933152653");

    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  afterEach(() => {
    mouse.reset();
    unmountComponent();
  });

  it("shows the trusted domains action for embeddable elements and opens the dialog", async () => {
    const embeddable = API.createElement({
      type: "embeddable",
      x: 20,
      y: 20,
      width: 200,
      height: 120,
    });

    API.setElements([embeddable]);
    API.updateElement(embeddable, {
      link: "https://widgets.example.com/embed/abc",
    });
    API.setSelectedElements([embeddable]);

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 40,
      clientY: 40,
    });

    const contextMenu = UI.queryContextMenu();
    expect(contextMenu).not.toBeNull();

    const manageTrustedDomainsAction = queryByText(
      contextMenu!,
      "Manage trusted domains",
    );

    expect(manageTrustedDomainsAction).not.toBeNull();

    fireEvent.click(manageTrustedDomainsAction!);

    await waitFor(() => {
      expect(h.state.openDialog).toEqual({ name: "trustedDomains" });
      expect(screen.getByText("Trusted Embed Domains")).toBeInTheDocument();
    });
  });

  it("normalizes, stores, and removes trusted domains from the dialog", async () => {
    API.setAppState({ openDialog: { name: "trustedDomains" } });

    const input = screen.getByPlaceholderText("e.g. example.com");
    fireEvent.change(input, {
      target: { value: "Widgets.Example.com." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(h.state.trustedEmbedDomains).toEqual(["widgets.example.com"]);
      expect(screen.getByText("widgets.example.com")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(h.state.trustedEmbedDomains).toEqual([]);
      expect(
        screen.getByText("No custom trusted domains added yet."),
      ).toBeInTheDocument();
    });
  });

  it("rejects invalid and duplicate trusted domains", async () => {
    API.setAppState({
      openDialog: { name: "trustedDomains" },
      trustedEmbedDomains: ["widgets.example.com"],
    });

    const input = screen.getByPlaceholderText("e.g. example.com");

    fireEvent.change(input, {
      target: { value: "https://widgets.example.com/embed/abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(
        screen.getByText("Please enter a valid domain (e.g. example.com)"),
      ).toBeInTheDocument();
      expect(h.state.trustedEmbedDomains).toEqual(["widgets.example.com"]);
    });

    fireEvent.change(input, {
      target: { value: "widgets.example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(
        screen.getByText("This domain is already in the trusted list."),
      ).toBeInTheDocument();
      expect(h.state.trustedEmbedDomains).toEqual(["widgets.example.com"]);
    });
  });
});
