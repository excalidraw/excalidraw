import React, { useState, useRef, useEffect } from "react";
import styles from "./ColorPicker.module.css";
import { detectTouchDevice } from "../../utils/detectTouchDevice";

type ColorPickerProps = {
  colors: string[];
  selectedColor: string;
  onSelect: (color: string) => void;
  onClose?: () => void;
  // ...other props
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

  // Open panel (could be controlled by parent)
  const openPanel = () => setVisible(true);

  // Close panel
  const closePanel = () => {
    setVisible(false);
    onClose?.();
  };

  // Handle color selection
  const handleSelect = (color: string) => {
    onSelect(color);
    // Only auto-close if on touch/stylus device
    if (isTouchDevice) {
      closePanel();
    }
    // On desktop, remain open for quick multiple selection
  };

  // Optional: handle tap/click outside to close on touch devices
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

  // Optional: Manual close button ("X") for stretch goal
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
        {/* icon or swatch */}
        <span
          className={styles.selectedSwatch}
          style={{ background: selectedColor }}
        />
      </button>
      {visible && (
        <div
          className={styles.panel}
          ref={panelRef}
          // touch event for stylus/touch
          onTouchEnd={(e) => {
            // Prevent touch bubbling to document
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
                // for stylus/touch, add pointer/touch event too
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
