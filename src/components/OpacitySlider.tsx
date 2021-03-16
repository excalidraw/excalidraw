import React, { useEffect, ChangeEventHandler, WheelEventHandler } from "react";
import { EVENT } from "../constants";
import { t } from "../i18n";
import { KEYS } from "../keys";

export const OpacitySlider = ({
  onChange,
  onWheel,
  value,
}: {
  onChange: ChangeEventHandler<HTMLInputElement>;
  onWheel: WheelEventHandler<HTMLInputElement>;
  value: number | undefined;
}) => {
  const opacityInput = React.useRef<HTMLInputElement>(null);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === KEYS.O) {
      opacityInput.current?.focus();
    }
  };

  useEffect(() => {
    document.addEventListener(EVENT.KEYDOWN, handleKeyDown, false);

    return () => {
      document.removeEventListener(EVENT.KEYDOWN, handleKeyDown, false);
    };
  });

  return (
    <label className="control-label">
      {t("labels.opacity")}
      <input
        type="range"
        min="0"
        max="100"
        step="10"
        onChange={onChange}
        onWheel={onWheel}
        value={value}
        ref={opacityInput}
      />
    </label>
  );
};
