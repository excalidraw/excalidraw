import React from "react";
import ReactDOM from "react-dom";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../index";

// Unmount ReactDOM from root
ReactDOM.unmountComponentAtNode(document.getElementById("root")!);

it("just works", () => {
  const { getByTitle } = render(<App />);
  const rectangleTool = getByTitle("Rectangle — R, 2");
  const radio = rectangleTool.querySelector("input") as HTMLInputElement;
  fireEvent.click(rectangleTool);
  expect(radio.checked).toBeTruthy();
});
