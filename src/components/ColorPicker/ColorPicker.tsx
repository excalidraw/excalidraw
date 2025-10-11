import React, { useState, useRef, useEffect } from "react";
import styles from "./ColorPicker.module.css";
import { detectTouchDevice } from "../../utils/detectTouchDevice";

type ColorPickerProps = {
  colors: string[];
  selectedColor: string;
  onSelect: (color: string) => void;
  onClose?: () => void;
};

export const ColorPicker: React.FC<ColorPickerProps> = ({
  colors,
  selectedColor,
  onSelect,
  onClose,
}) => {
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const isTouchDevice = detectTouchDevice();

  const openPanel = () => setVisible(true);

  const closePanel = () => {
    setVisible(false);
    onClose?.();
  };

  const handleSelect = (color: string) => {
    onSelect(color);
    if (isTouchDevice) {
      closePanel();
    }
  };

  useEffect(() => {
    if (!visible || !isTouchDevice) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        closePanel();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [visible, isTouchDevice]);

  const renderCloseButton = () =>
    isTouchDevice ? (
      <button
        className={styles.closeBtn}
        aria-label="Close color panel"
        onClick={closePanel}
        tabIndex={0}
      >
        ×
      </button>
    ) : null;

  return (
    <div className={styles.wrapper}>
      <button className={styles.trigger} onClick={openPanel}>
        <span
          className={styles.selectedSwatch}
          style={{ background: selectedColor }}
        />
      </button>
      {visible && (
        <div
          className={styles.panel}
          ref={panelRef}
          onTouchEnd={(e) => {
            e.stopPropagation();
          }}
        >
          {renderCloseButton()}
          <div className={styles.colorGrid}>
            {colors.map((color) => (
              <div
                key={color}
                className={
                  color === selectedColor
                    ? styles.swatchSelected
                    : styles.swatch
                }
                style={{ background: color }}
                onClick={() => handleSelect(color)}
                onPointerUp={() => {
                  if (isTouchDevice) handleSelect(color);
                }}
                tabIndex={0}
                aria-label={`Select color ${color}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorPicker;