import "./Island.scss";

import React from "react";
import clsx from "clsx";

type IslandProps = {
  children: React.ReactNode;
  padding?: number;
  className?: string | boolean;
  style?: object;
  ref?: React.Ref<HTMLDivElement>;
};

export const Island = ({
  children,
  padding,
  className,
  style,
  ref,
}: IslandProps) => (
  <div
    className={clsx("Island", className)}
    style={{ "--padding": padding, ...style }}
    ref={ref}
  >
    {children}
  </div>
);
