import React from "react";
import { Popover } from "./Popover";
import { render, unmountComponentAtNode } from "react-dom";

import "./ContextMenu.scss";

type ContextMenuOption = {
  label: string;
  action(): void;
};

type Props = {
  options: ContextMenuOption[];
  onCloseRequest?(): void;
  top: number;
  left: number;
};

function ContextMenu({ options, onCloseRequest, top, left }: Props) {
  return (
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
        {options.map((option, idx) => (
          <li key={idx} onClick={onCloseRequest}>
            <ContextMenuOption {...option} />
          </li>
        ))}
      </ul>
    </Popover>
  );
}

function ContextMenuOption({ label, action }: ContextMenuOption) {
  return (
    <button className="context-menu-option" onClick={action}>
      {label}
    </button>
  );
}

let contextMenuNode: HTMLDivElement;
function getContextMenuNode(): HTMLDivElement {
  if (contextMenuNode) {
    return contextMenuNode;
  }
  const div = document.createElement("div");
  document.body.appendChild(div);
  return (contextMenuNode = div);
}

type ContextMenuParams = {
  options: (ContextMenuOption | false | null | undefined)[];
  top: number;
  left: number;
};

function handleClose() {
  unmountComponentAtNode(getContextMenuNode());
}

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
