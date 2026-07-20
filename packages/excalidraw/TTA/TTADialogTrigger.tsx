import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

import { useAtomValue } from "../editor-jotai";
import { MagicIconThin } from "../components/icons";
import { isSidebarDockedAtom } from "../components/Sidebar/Sidebar";
import { useTunnels } from "../context/tunnels";

import type { ReactNode } from "react";

type TTADialogTriggerProps = {
  isOpen: boolean;
  isPinned: boolean;
  hasOpenSidebar: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export const TTADialogTrigger = ({
  isOpen,
  isPinned,
  hasOpenSidebar,
  onToggle,
  children,
}: TTADialogTriggerProps) => {
  const { TTADialogTriggerTunnel } = useTunnels();
  const isSidebarDocked = useAtomValue(isSidebarDockedAtom);
  const launcherRef = useRef<HTMLDivElement>(null);
  const [sidebarShiftPx, setSidebarShiftPx] = useState(0);
  const [triggerShiftPx, setTriggerShiftPx] = useState(0);

  useEffect(() => {
    const needsPanelShift = isOpen && isPinned && hasOpenSidebar;
    const needsTriggerShift = hasOpenSidebar && !isSidebarDocked;

    if (!needsPanelShift && !needsTriggerShift) {
      setSidebarShiftPx(0);
      setTriggerShiftPx(0);
      return;
    }

    const sidebarEl = document.querySelector<HTMLElement>(".sidebar");
    if (!sidebarEl) {
      setSidebarShiftPx(0);
      setTriggerShiftPx(0);
      return;
    }

    const updateShift = () => {
      const sidebarRect = sidebarEl.getBoundingClientRect();
      const sidebarWidth = sidebarRect.width;
      const remPx =
        parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

      if (needsPanelShift) {
        // `.tta-floating-launcher` uses `right: 1rem` by default, so subtract it
        // then add 1rem gap so the panel doesn't sit flush against the sidebar.
        const launcherRight =
          parseFloat(
            getComputedStyle(launcherRef.current ?? sidebarEl).right,
          ) || 0;

        setSidebarShiftPx(Math.max(0, sidebarWidth - launcherRight + remPx));
      } else {
        setSidebarShiftPx(0);
      }

      if (needsTriggerShift) {
        // When sidebar is undocked (floating), position the trigger button
        // with the same gap from the sidebar as the dialog panel.
        setTriggerShiftPx(sidebarWidth + remPx);
      } else {
        setTriggerShiftPx(0);
      }
    };

    updateShift();

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateShift);
    resizeObserver?.observe(sidebarEl);

    window.addEventListener("resize", updateShift);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateShift);
    };
  }, [hasOpenSidebar, isOpen, isPinned, isSidebarDocked]);

  const launcherStyle = {
    transform: sidebarShiftPx ? `translateX(-${sidebarShiftPx}px)` : undefined,
  } as const;

  const triggerStyle = triggerShiftPx
    ? ({
        position: "fixed" as const,
        bottom: "1rem",
        right: `${triggerShiftPx}px`,
        zIndex: 100,
      } as const)
    : undefined;

  return (
    <>
      <TTADialogTriggerTunnel.In>
        <div className="tta-floating-inline" style={triggerStyle}>
          <button
            className={clsx("tta-floating-button", {
              "tta-floating-button--active": isOpen,
            })}
            type="button"
            aria-expanded={isOpen}
            aria-controls="tta-floating-panel"
            onClick={onToggle}
          >
            <span className="tta-floating-button__icon">{MagicIconThin}</span>
            <span>Generate</span>
          </button>
        </div>
      </TTADialogTriggerTunnel.In>
      {isOpen && (
        <div
          ref={launcherRef}
          className="tta-floating-launcher"
          style={launcherStyle}
        >
          {children}
        </div>
      )}
    </>
  );
};
