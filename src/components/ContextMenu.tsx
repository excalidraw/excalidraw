import React from "react";
import { render, unmountComponentAtNode } from "react-dom";
import clsx from "clsx";
import { Popover } from "./Popover";

import "./ContextMenu.scss";
import {
  getShortcutFromShortcutName,
  ShortcutName,
} from "../actions/shortcuts";

type ContextMenuOption = {
  checked?: boolean;
  shortcutName: ShortcutName;
  label: string;
  action(): void;
};

type Props = {
  options: ContextMenuOption[];
  onCloseRequest?(): void;
  top: number;
  left: number;
};

const ContextMenu = ({ options, onCloseRequest, top, left }: Props) => {
  const isDarkTheme = !!document
    .querySelector(".excalidraw")
    ?.classList.contains("Appearance_dark");
  return (
    <div
      className={clsx("excalidraw", {
        "Appearance_dark Appearance_dark-background-none": isDarkTheme,
      })}
    >
      <Popover
        onCloseRequest={onCloseRequest}
        top={top}
        left={left}
        fitInViewport={true}
      >
        <ul
          className="context-menu"
          onContextMenu={(event) => event.preventDefault()}
        >
          {options.map(({ action, checked, shortcutName, label }, idx) => (
            <li data-testid={shortcutName} key={idx} onClick={onCloseRequest}>
              <button
                className={`context-menu-option 
                ${shortcutName === "delete" ? "dangerous" : ""}
                ${checked ? "checkmark" : ""}`}
                onClick={action}
              >
                <div className="context-menu-option__label">{label}</div>
                <div className="context-menu-option__shortcut">
                  {shortcutName
                    ? getShortcutFromShortcutName(shortcutName)
                    : ""}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </Popover>
    </div>
  );
};

let contextMenuNode: HTMLDivElement;
const getContextMenuNode = (): HTMLDivElement => {
  if (contextMenuNode) {
    return contextMenuNode;
  }
  const div = document.createElement("div");
  document.body.appendChild(div);
  return (contextMenuNode = div);
};

type ContextMenuParams = {
  options: (ContextMenuOption | false | null | undefined)[];
  top: number;
  left: number;
};

const handleClose = () => {
  unmountComponentAtNode(getContextMenuNode());
};

export default {
  push(params: ContextMenuParams) {
    const options = Array.of<ContextMenuOption>();
    params.options.forEach((option) => {
      if (option) {
        options.push(option);
      }
    });
    if (options.length) {
      render(
        <ContextMenu
          top={params.top}
          left={params.left}
          options={options}
          onCloseRequest={handleClose}
        />,
        getContextMenuNode(),
      );
    }
  },
};
