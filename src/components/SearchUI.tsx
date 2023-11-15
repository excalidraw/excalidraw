import clsx from "clsx";
import { chevronLeftIcon, chevronRightIcon, searchToolIcon } from "./icons";
import { ToolButtonSize } from "./ToolButton";
import { useEffect, useRef } from "react";
import { t } from "../i18n";
import { AppState } from "../types";

const DEFAULT_SIZE: ToolButtonSize = "medium";

type SearchToolProps = {
  title?: string;
  name?: string;
  checked: boolean;
  isMobile?: boolean;
  searchToolData: AppState["searchTool"];
  onChange?(): void;
  onQueryChange?(query: string): void;
  onGoResult?(index: number): void;
};

function SearchUIButtonWrap({
  className,
  isMobile,
  title,
  children,
}: {
  className?: string;
  isMobile?: boolean;
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <label
      className={clsx(className ?? "", `ToolIcon_size_${DEFAULT_SIZE}`, {
        "is-mobile": isMobile,
      })}
      title={title}
    >
      {children}
    </label>
  );
}

export const SearchTool = (props: SearchToolProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (props.checked && inputRef.current) {
      inputRef.current.focus();
    }
  }, [props.checked]);

  return (
    <>
      <SearchUIButtonWrap
        className="ToolIcon ToolIcon__search_trigger"
        title={t("toolBar.searchSwitch")}
        isMobile={props.isMobile}
      >
        <input
          className="ToolIcon_type_checkbox"
          type="checkbox"
          name={props.name}
          onChange={props.onChange}
          checked={props.checked}
          aria-label={props.title}
          data-testid="toolbar-search"
        />
        <div className="ToolIcon__icon">{searchToolIcon}</div>
      </SearchUIButtonWrap>
      {props.checked ? (
        <span>
          <input
            ref={inputRef}
            type="text"
            placeholder={t("toolBar.searchPlaceholder")}
            defaultValue={props.searchToolData.query}
            onChange={(ev) =>
              props.onQueryChange && props.onQueryChange(ev.target.value)
            }
          />
        </span>
      ) : (
        ""
      )}
      {props.checked &&
      props.searchToolData.results &&
      props.searchToolData.results.length > 0 ? (
        <>
          <SearchUIButtonWrap
            className="ToolIcon ToolIcon__search_prev"
            title={t("toolBar.searchGoPrev")}
            isMobile={props.isMobile}
          >
            <div
              className="ToolIcon__icon"
              onClick={() => {
                const prev =
                  props.searchToolData.resultsPos > 0
                    ? props.searchToolData.resultsPos - 1
                    : props.searchToolData.results.length - 1;
                props.onGoResult && props.onGoResult(prev);
              }}
            >
              {chevronLeftIcon}
            </div>
          </SearchUIButtonWrap>
          <label
            className={clsx(
              "ToolIcon ToolIcon__search_count",
              `ToolIcon_size_${DEFAULT_SIZE}`,
              {
                "is-mobile": props.isMobile,
              },
            )}
          >
            {props.searchToolData.resultsPos + 1}
            {"/"}
            {props.searchToolData.results.length}
          </label>
          <SearchUIButtonWrap
            className="ToolIcon ToolIcon__search_next"
            title={t("toolBar.searchGoNext")}
            isMobile={props.isMobile}
          >
            <div
              className="ToolIcon__icon"
              onClick={() => {
                const next =
                  props.searchToolData.resultsPos + 1 <
                  props.searchToolData.results.length
                    ? props.searchToolData.resultsPos + 1
                    : 0;
                props.onGoResult && props.onGoResult(next);
              }}
            >
              {chevronRightIcon}
            </div>
          </SearchUIButtonWrap>
        </>
      ) : (
        ""
      )}
    </>
  );
};
