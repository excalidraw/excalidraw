import { queries, buildQueries } from "@testing-library/react";

const _getAllByToolName = (container: HTMLElement, tool: string) => {
  const toolMap: { [propKey: string]: string } = {
    selection: "Selection — S, 1",
    rectangle: "Rectangle — R, 2",
    diamond: "Diamond — D, 3",
    ellipse: "Ellipse — E, 4",
    arrow: "Arrow — A, 5",
    line: "Line — L, 6",
  };

  const toolTitle = toolMap[tool as string];
  return queries.getAllByTitle(container, toolTitle);
};

const getMultipleError = (c: any, tool: any) =>
  `Found multiple elements with tool name: ${tool}`;
const getMissingError = (c: any, tool: any) =>
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
