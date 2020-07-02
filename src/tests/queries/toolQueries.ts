import { queries, buildQueries } from "@testing-library/react";

const toolMap = {
  selection: "selection",
  rectangle: "rectangle",
  diamond: "diamond",
  ellipse: "ellipse",
  arrow: "arrow",
  line: "line",
  draw: "draw",
  text: "text",
};

export type ToolName = keyof typeof toolMap;

const _getAllByToolName = (container: HTMLElement, tool: string) => {
  const toolTitle = toolMap[tool as ToolName];
  return queries.getAllByTestId(container, toolTitle);
};

const getMultipleError = (_container: any, tool: any) =>
  `Found multiple elements with tool name: ${tool}`;
const getMissingError = (_container: any, tool: any) =>
  `Unable to find an element with tool name: ${tool}`;

export const [
  queryByToolName,
  getAllByToolName,
  getByToolName,
  findAllByToolName,
  findByToolName,
] = buildQueries<string[]>(
  _getAllByToolName,
  getMultipleError,
  getMissingError,
);
