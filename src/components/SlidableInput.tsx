import React, { CSSProperties, useEffect, useState } from "react";
import classes from "./SlidableInput.module.css";
import { throttle } from "./utils/throttle";

interface SlidableInputProps {
  value: number;
  prefix?: string;
  suffix?: string;
  minValue?: number;
  maxValue?: number;
  style?: CSSProperties;
  onChange?: (value: number) => void;
}

export const SlidableInput: React.FC<SlidableInputProps> = ({
  value,
  style,
  prefix,
  suffix,
  onChange,
  minValue,
  maxValue,
}) => {
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const previousX = React.useRef(0);

  useEffect(() => {
    const onMouseMoveHandler = throttle((event: MouseEvent) => {
      if (isLocked) return;

      const nextX = event.screenX;
      if (nextX === previousX.current) return;
      const nextValue = value + (nextX > previousX.current ? 1 : -1);

      onChange &&
        nextValue <= (maxValue || Infinity) &&
        nextValue >= (typeof minValue === "number" ? minValue : -Infinity) &&
        onChange(nextValue);

      previousX.current = nextX;
    }, 250) as EventListenerOrEventListenerObject;

    window.addEventListener("mousemove", onMouseMoveHandler);

    return () => {
      window.removeEventListener("mousemove", onMouseMoveHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked, value]);

  const onMouseDown = () => setIsLocked(false);

  useEffect(() => {
    const onMouseUp = () => setIsLocked(true);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <span className={classes.input} style={style} onMouseDown={onMouseDown}>
      {prefix}
      {value}
      {suffix}
    </span>
  );
};
