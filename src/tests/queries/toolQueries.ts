import { queries, buildQueries } from "@testing-library/react";

const toolMap = {
  selection: "Selection — S, 1",
  rectangle: "Rectangle — R, 2",
  diamond: "Diamond — D, 3",
  ellipse: "Ellipse — E, 4",
  arrow: "Arrow — A, 5",
  line: "Line — L, 6",
};

export type ToolName = keyof typeof toolMap;

const _getAllByToolName = (container: HTMLElement, tool: string) => {
  const toolTitle = toolMap[tool as ToolName];
  return queries.getAllByTitle(container, toolTitle);
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
