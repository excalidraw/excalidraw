import clsx from "clsx";
import React from "react";

import { searchIcon } from "./icons";

import "./QuickSearch.scss";

interface QuickSearchProps {
  className?: string;
  placeholder: string;
  onChange: (term: string) => void;
}

export const QuickSearch = React.forwardRef<HTMLInputElement, QuickSearchProps>(
  ({ className, placeholder, onChange }, ref) => {
    return (
      <div className={clsx("QuickSearch__wrapper", className)}>
        {searchIcon}
        <input
          ref={ref}
          className="QuickSearch__input"
          type="text"
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value.trim().toLowerCase())}
        />
      </div>
    );
  },
);
