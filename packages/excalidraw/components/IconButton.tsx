import clsx from "clsx";
import React, { useEffect, useRef, useState } from "react";

import { isPromiseLike } from "@excalidraw/common";

import type { PointerType } from "@excalidraw/element/types";

import { AbortError } from "../errors";

import "./ToolIcon.scss";

import Spinner from "./Spinner";

import type { CSSProperties } from "react";

export type IconButtonSize = "small" | "medium";

type IconButtonBaseProps = {
  icon?: React.ReactNode;
  "aria-label": string;
  "aria-keyshortcuts"?: string;
  "data-testid"?: string;
  label?: string;
  title?: string;
  size?: IconButtonSize;
  keyBindingLabel?: string | null;
  showAriaLabel?: boolean;
  hidden?: boolean;
  visible?: boolean;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  isLoading?: boolean;
};

type IconButtonProps =
  | (IconButtonBaseProps & {
      type: "button";
      children?: React.ReactNode;
      onClick?(event: React.MouseEvent): void;
    })
  | (IconButtonBaseProps & {
      type: "icon";
      children?: React.ReactNode;
      onClick?(): void;
    })
  // a stateful (pressed/unpressed) tool button
  | (IconButtonBaseProps & {
      type: "toggle";
      checked: boolean;
      /**
       * Fired on activation — a completed pointer gesture (via `click`, so a
       * press canceled by sliding off the button doesn't select) or
       * keyboard/AT activation, in which case pointerType is null.
       * pointerType is captured on pointer-down, where it's reliable
       * (unlike the click event's own pointerType on iOS).
       */
      onSelect?(data: { pointerType: PointerType | null }): void;
    });

export const IconButton = React.forwardRef(
  (
    {
      size = "medium",
      visible = true,
      className = "",
      ...props
    }: IconButtonProps,
    ref,
  ) => {
    const innerRef = React.useRef(null);
    React.useImperativeHandle(ref, () => innerRef.current);
    const sizeCn = `ToolIcon_size_${size}`;

    const [isLoading, setIsLoading] = useState(false);

    const isMountedRef = useRef(true);

    const onClick = async (event: React.MouseEvent) => {
      const ret = "onClick" in props && props.onClick?.(event);

      if (isPromiseLike(ret)) {
        try {
          setIsLoading(true);
          await ret;
        } catch (error: any) {
          if (!(error instanceof AbortError)) {
            throw error;
          } else {
            console.warn(error);
          }
        } finally {
          if (isMountedRef.current) {
            setIsLoading(false);
          }
        }
      }
    };

    useEffect(() => {
      isMountedRef.current = true;
      return () => {
        isMountedRef.current = false;
      };
    }, []);

    const lastPointerTypeRef = useRef<PointerType | null>(null);

    if (props.type === "button" || props.type === "icon") {
      return (
        <button
          className={clsx(
            "ToolIcon_type_button",
            sizeCn,
            className,
            visible && !props.hidden
              ? "ToolIcon_type_button--show"
              : "ToolIcon_type_button--hide",
            {
              ToolIcon: !props.hidden,
              "ToolIcon--plain": props.type === "icon",
            },
          )}
          style={props.style}
          data-testid={props["data-testid"]}
          hidden={props.hidden}
          title={props.title}
          aria-label={props["aria-label"]}
          type="button"
          onClick={onClick}
          ref={innerRef}
          disabled={isLoading || props.isLoading || !!props.disabled}
        >
          {(props.icon || props.label) && (
            <div
              className="ToolIcon__icon"
              aria-hidden="true"
              aria-disabled={!!props.disabled}
            >
              {props.icon || props.label}
              {props.keyBindingLabel && (
                <span className="ToolIcon__keybinding">
                  {props.keyBindingLabel}
                </span>
              )}
              {props.isLoading && <Spinner />}
            </div>
          )}
          {props.showAriaLabel && (
            <div className="ToolIcon__label">
              {props["aria-label"]} {isLoading && <Spinner />}
            </div>
          )}
          {props.children}
        </button>
      );
    }

    return (
      <button
        className={clsx("ToolIcon", "ToolIcon_type_toggle", sizeCn, className, {
          "ToolIcon--checked": props.checked,
        })}
        type="button"
        style={props.style}
        title={props.title}
        aria-label={props["aria-label"]}
        aria-keyshortcuts={props["aria-keyshortcuts"]}
        aria-pressed={props.checked}
        data-testid={props["data-testid"]}
        onPointerDown={(event) => {
          lastPointerTypeRef.current = event.pointerType || null;
        }}
        onPointerUp={() => {
          requestAnimationFrame(() => {
            lastPointerTypeRef.current = null;
          });
        }}
        onClick={() => {
          props.onSelect?.({ pointerType: lastPointerTypeRef.current });
        }}
        ref={innerRef}
      >
        <div className="ToolIcon__icon">
          {props.icon}
          {props.keyBindingLabel && (
            <span className="ToolIcon__keybinding">
              {props.keyBindingLabel}
            </span>
          )}
        </div>
      </button>
    );
  },
);

IconButton.displayName = "IconButton";
