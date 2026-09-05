import { useCallback, useRef, useState } from "react";

import RoughBox from "@/components/RoughBox";
import downloadIcon from "@/assets/icons/download.svg";
import { FIELD_OPTIONS } from "@/config";
import { useDismiss } from "@/hooks/useDismiss";

export interface DownloadOption {
  id: string;
  label: string;
  /** Greyed out when the response has nothing to save in that format. */
  disabled?: boolean;
}

interface DownloadMenuProps {
  options: DownloadOption[];
  onSelect: (id: string) => void;
}

/** Download icon that drops a sketch-framed list of formats. */
export function DownloadMenu({ options, onSelect }: DownloadMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useDismiss(rootRef, useCallback(() => setOpen(false), []), open);

  const dividers = Array.from(
    { length: Math.max(options.length - 1, 0) },
    (_, index) => (index + 1) / options.length,
  );

  return (
    <div className="download" ref={rootRef}>
      <button
        className="message__action"
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-label="Download response"
        aria-expanded={open}
        title="Download"
      >
        <img src={downloadIcon} alt="" width={26} height={26} />
      </button>

      {open && (
        <div className="download__menu">
          <RoughBox options={FIELD_OPTIONS} dividers={dividers} />
          <div className="download__options">
            {options.map((option) => (
              <button
                key={option.id}
                className="download__option"
                type="button"
                disabled={option.disabled}
                onClick={() => {
                  onSelect(option.id);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DownloadMenu;
