import React from "react";

type Props = {
  top?: number;
  left?: number;
  children?: React.ReactNode;
  onCloseRequest?(): void;
};

export function Popover({ children, left, onCloseRequest, top }: Props) {
  return (
    <div className="popover" style={{ top: top, left: left }}>
      <div
        className="cover"
        onClick={onCloseRequest}
        onContextMenu={e => {
          e.preventDefault();
          if (onCloseRequest) onCloseRequest();
        }}
      />
      {children}
    </div>
  );
}
