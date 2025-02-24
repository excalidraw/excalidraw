import "./Stack.scss";

import React from "react";
import clsx from "clsx";

type StackProps = {
  children: React.ReactNode;
  gap?: number;
  align?: "start" | "center" | "end" | "baseline";
  justifyContent?: "center" | "space-around" | "space-between";
  className?: string | boolean;
  style?: React.CSSProperties;
  ref?: React.Ref<HTMLDivElement>;
};

const RowStack = ({
  children,
  gap,
  align,
  justifyContent,
  className,
  style,
  ref,
}: StackProps) => {
  return (
    <div
      className={clsx("Stack Stack_horizontal", className)}
      style={{
        "--gap": gap,
        alignItems: align,
        justifyContent,
        ...style,
      }}
      ref={ref}
    >
      {children}
    </div>
  );
};

const ColStack = ({
  children,
  gap,
  align,
  justifyContent,
  className,
  style,
  ref,
}: StackProps) => {
  return (
    <div
      className={clsx("Stack Stack_vertical", className)}
      style={{
        "--gap": gap,
        justifyItems: align,
        justifyContent,
        ...style,
      }}
      ref={ref}
    >
      {children}
    </div>
  );
};

export default {
  Row: RowStack,
  Col: ColStack,
};
