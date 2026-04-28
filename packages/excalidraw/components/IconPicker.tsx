import { Popover } from "radix-ui";
import clsx from "clsx";
import React, { useEffect, useMemo } from "react";

import { isArrowKey, KEYS } from "@excalidraw/common";

import { atom, useAtom } from "../editor-jotai";
import { getLanguage, t } from "../i18n";

import Collapsible from "./Stats/Collapsible";
import { useExcalidrawContainer } from "./App";

import "./IconPicker.scss";

import type { JSX } from "react";

const moreOptionsAtom = atom(false);
const PICKER_COLUMNS = 4;
const DEFAULT_SECTION_NAME = "default";

type Option<T> = {
  value: T;
  text: string;
  icon: JSX.Element;
  keyBinding: string | null;
};

type PickerSection<T> = {
  name: string;
  options: readonly Option<T>[];
};

const flattenOptions = <T,>(sections: readonly PickerSection<T>[]) =>
  sections.flatMap((section) => section.options);

const findOption = <T,>(
  sections: readonly PickerSection<T>[],
  predicate: (option: Option<T>) => boolean,
) => {
  for (const section of sections) {
    const option = section.options.find(predicate);
    if (option) {
      return option;
    }
  }

  return null;
};

const hasOption = <T,>(
  sections: readonly PickerSection<T>[],
  predicate: (option: Option<T>) => boolean,
) => sections.some((section) => section.options.some(predicate));

const getNavigationRows = <T,>(sections: readonly PickerSection<T>[]) =>
  sections.flatMap((section) =>
    Array.from(
      { length: Math.ceil(section.options.length / PICKER_COLUMNS) },
      (_, index) =>
        section.options.slice(
          index * PICKER_COLUMNS,
          index * PICKER_COLUMNS + PICKER_COLUMNS,
        ),
    ),
  );

function Picker<T>({
  visibleSections,
  hiddenSections = [],
  value,
  label,
  onChange,
  onClose,
}: {
  label: string;
  value: T;
  visibleSections: readonly PickerSection<T>[];
  hiddenSections?: readonly PickerSection<T>[];
  onChange: (value: T) => void;
  onClose: () => void;
}) {
  const { container } = useExcalidrawContainer();
  const [showMoreOptions, setShowMoreOptions] = useAtom(moreOptionsAtom);
  const allSections = [...visibleSections, ...hiddenSections];
  const allOptions = flattenOptions(allSections);
  const navigationRows = getNavigationRows([
    ...visibleSections,
    ...(showMoreOptions ? hiddenSections : []),
  ]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const pressedOption = allOptions.find(
      (option) => option.keyBinding === event.key.toLowerCase(),
    );

    if (!(event.metaKey || event.altKey || event.ctrlKey) && pressedOption) {
      // Keybinding navigation
      onChange(pressedOption.value);

      event.preventDefault();
    } else if (event.key === KEYS.TAB) {
      const index = allOptions.findIndex((option) => option.value === value);
      const nextIndex = event.shiftKey
        ? (allOptions.length + index - 1) % allOptions.length
        : (index + 1) % allOptions.length;
      onChange(allOptions[nextIndex].value);
    } else if (isArrowKey(event.key)) {
      // Arrow navigation
      const isRTL = getLanguage().rtl;
      const index = allOptions.findIndex((option) => option.value === value);
      if (index !== -1) {
        const length = allOptions.length;
        let nextIndex = index;

        switch (event.key) {
          // Select the next option
          case isRTL ? KEYS.ARROW_LEFT : KEYS.ARROW_RIGHT:
            nextIndex = (index + 1) % length;
            break;
          // Select the previous option
          case isRTL ? KEYS.ARROW_RIGHT : KEYS.ARROW_LEFT:
            nextIndex = (length + index - 1) % length;
            break;
          // Go the next row
          case KEYS.ARROW_DOWN: {
            const currentRowIndex = navigationRows.findIndex((row) =>
              row.some((option) => option.value === value),
            );
            const currentRow = navigationRows[currentRowIndex];

            if (currentRowIndex !== -1 && currentRow) {
              const column = currentRow.findIndex(
                (option) => option.value === value,
              );
              const nextRow =
                navigationRows[(currentRowIndex + 1) % navigationRows.length];
              const nextOption =
                nextRow[Math.min(column, nextRow.length - 1)] ??
                allOptions[index];

              onChange(nextOption.value);
              event.preventDefault();
              event.nativeEvent.stopImmediatePropagation();
              event.stopPropagation();
              return;
            }
            break;
          }
          // Go the previous row
          case KEYS.ARROW_UP: {
            const currentRowIndex = navigationRows.findIndex((row) =>
              row.some((option) => option.value === value),
            );
            const currentRow = navigationRows[currentRowIndex];

            if (currentRowIndex !== -1 && currentRow) {
              const column = currentRow.findIndex(
                (option) => option.value === value,
              );
              const previousRow =
                navigationRows[
                  (navigationRows.length + currentRowIndex - 1) %
                    navigationRows.length
                ];
              const previousOption =
                previousRow[Math.min(column, previousRow.length - 1)] ??
                allOptions[index];

              onChange(previousOption.value);
              event.preventDefault();
              event.nativeEvent.stopImmediatePropagation();
              event.stopPropagation();
              return;
            }
            break;
          }
        }

        onChange(allOptions[nextIndex].value);
      }
      event.preventDefault();
    } else if (event.key === KEYS.ESCAPE || event.key === KEYS.ENTER) {
      // Close on escape or enter
      event.preventDefault();
      onClose();
    }
    event.nativeEvent.stopImmediatePropagation();
    event.stopPropagation();
  };

  useEffect(() => {
    if (hasOption(hiddenSections, (option) => option.value === value)) {
      setShowMoreOptions(true);
    }
  }, [value, hiddenSections, setShowMoreOptions]);

  const renderOptions = (options: readonly Option<T>[]) => {
    return (
      <div className="picker-content">
        {options.map((option) => (
          <button
            type="button"
            className={clsx("picker-option", {
              active: value === option.value,
            })}
            onClick={() => {
              onChange(option.value);
            }}
            title={
              option.keyBinding
                ? `${option.text} — ${option.keyBinding.toUpperCase()}`
                : option.text
            }
            aria-label={option.text || "none"}
            aria-keyshortcuts={option.keyBinding || undefined}
            key={option.text}
            ref={(ref) => {
              if (value === option.value) {
                // Use a timeout here to render focus properly
                setTimeout(() => {
                  ref?.focus();
                }, 0);
              }
            }}
          >
            {option.icon}
            {option.keyBinding && (
              <span className="picker-keybinding">{option.keyBinding}</span>
            )}
          </button>
        ))}
      </div>
    );
  };

  const renderSections = (sections: readonly PickerSection<T>[]) =>
    sections.map((section, index) =>
      section.name === DEFAULT_SECTION_NAME ? (
        <React.Fragment key={`${section.name}-${index}`}>
          {renderOptions(section.options)}
        </React.Fragment>
      ) : (
        <div className="picker-section" key={`${section.name}-${index}`}>
          <div className="picker-section-label">{section.name}</div>
          {renderOptions(section.options)}
        </div>
      ),
    );

  return (
    <Popover.Content
      className="picker"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      side={"bottom"}
      align="start"
      sideOffset={12}
      alignOffset={12}
      style={{ zIndex: "var(--zIndex-ui-styles-popup)" }}
      onKeyDown={handleKeyDown}
      collisionBoundary={container ?? undefined}
    >
      <div className="picker-sections">
        {renderSections(visibleSections)}

        {hiddenSections.length > 0 && (
          <Collapsible
            label={t("labels.more_options")}
            open={showMoreOptions}
            openTrigger={() => {
              setShowMoreOptions((value) => !value);
            }}
            className="picker-collapsible"
          >
            <div className="picker-sections">
              {renderSections(hiddenSections)}
            </div>
          </Collapsible>
        )}
      </div>
    </Popover.Content>
  );
}

export function IconPicker<T>({
  value,
  label,
  visibleSections,
  hiddenSections,
  onChange,
}: {
  label: string;
  value: T;
  visibleSections: readonly PickerSection<T>[];
  hiddenSections?: readonly PickerSection<T>[];
  onChange: (value: T) => void;
}) {
  const [isActive, setActive] = React.useState(false);
  const selectedOption = useMemo(
    () =>
      findOption(visibleSections, (option) => option.value === value) ??
      findOption(hiddenSections ?? [], (option) => option.value === value),
    [visibleSections, hiddenSections, value],
  );

  return (
    <div>
      <Popover.Root open={isActive} onOpenChange={(open) => setActive(open)}>
        <Popover.Trigger
          type="button"
          aria-label={label}
          onClick={() => setActive(!isActive)}
          className={isActive ? "active" : ""}
        >
          {selectedOption?.icon}
        </Popover.Trigger>
        {isActive && (
          <Picker
            visibleSections={visibleSections}
            hiddenSections={hiddenSections}
            value={value}
            label={label}
            onChange={onChange}
            onClose={() => {
              setActive(false);
            }}
          />
        )}
      </Popover.Root>
    </div>
  );
}
