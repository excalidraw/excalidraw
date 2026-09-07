import clsx from "clsx";
import { Children, forwardRef } from "react";

import "./ScrollableList.scss";

interface ScrollableListProps {
  className?: string;
  placeholder: string;
  children: React.ReactNode;
}

export const ScrollableList = forwardRef<HTMLDivElement, ScrollableListProps>(
  ({ className, placeholder, children }, ref) => {
    const isEmpty = !Children.count(children);

    return (
      <div
        ref={ref}
        className={clsx("ScrollableList__wrapper", className)}
        role="menu"
      >
        {isEmpty ? <div className="empty">{placeholder}</div> : children}
      </div>
    );
  },
);
