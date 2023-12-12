import { queries, buildQueries } from "@testing-library/react";
import { ToolType } from "../../types";
import { TOOL_TYPE } from "../../constants";

const _getAllByToolName = (container: HTMLElement, tool: ToolType | "lock") => {
  const toolTitle = tool === "lock" ? "lock" : TOOL_TYPE[tool];
  return queries.getAllByTestId(container, `toolbar-${toolTitle}`);
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
] = buildQueries<(ToolType | "lock")[]>(
  _getAllByToolName,
  getMultipleError,
  getMissingError,
);
