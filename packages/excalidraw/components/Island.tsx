import "./Island.scss";

import clsx from "clsx";
import React from "react";
import Draggable from "react-draggable";

type IslandProps = {
  children: React.ReactNode;
  padding?: number;
  className?: string | boolean;
  style?: object;
  draggable?: boolean;
};

export const Island = React.forwardRef<HTMLDivElement, IslandProps>(
  ({ children, padding, className, style, draggable }, ref) =>
    draggable ? (
      <Draggable>
        <div className={clsx("Island", className)} 
          style={{ "--padding": padding, ...style }}
          ref={ref}>
          {children}
        </div>
      </Draggable>
    ) : (
      <div
        className={clsx("Island", className)}
        style={{ "--padding": padding, ...style }}
        ref={ref}
      >
        {children}
      </div>
    ),
);
