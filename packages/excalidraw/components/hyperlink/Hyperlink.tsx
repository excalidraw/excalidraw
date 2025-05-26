import { pointFrom, type GlobalPoint } from "@excalidraw/math";
import clsx from "clsx";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { EVENT, HYPERLINK_TOOLTIP_DELAY, KEYS } from "@excalidraw/common";

import { getElementAbsoluteCoords } from "@excalidraw/element";

import { hitElementBoundingBox } from "@excalidraw/element";

import { isElementLink } from "@excalidraw/element";

import { getEmbedLink, embeddableURLValidator } from "@excalidraw/element";

import {
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
  wrapEvent,
  isLocalLink,
  normalizeLink,
} from "@excalidraw/common";

import { isEmbeddableElement } from "@excalidraw/element";

import type { Scene } from "@excalidraw/element";

import type {
  ElementsMap,
  ExcalidrawEmbeddableElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { trackEvent } from "../../analytics";
import { getTooltipDiv, updateTooltipPosition } from "../../components/Tooltip";

import { t } from "../../i18n";

import { useAppProps, useDevice, useExcalidrawAppState } from "../App";
import { ToolButton } from "../ToolButton";
import { FreedrawIcon, TrashIcon, elementLinkIcon } from "../icons";
import { getSelectedElements } from "../../scene";

import { getLinkHandleFromCoords } from "./helpers";

import "./Hyperlink.scss";

import type { AppState, ExcalidrawProps, UIAppState } from "../../types";

const POPUP_WIDTH = 380;
const POPUP_HEIGHT = 42;
const POPUP_PADDING = 5;
const SPACE_BOTTOM = 85;
const AUTO_HIDE_TIMEOUT = 500;

let IS_HYPERLINK_TOOLTIP_VISIBLE = false;

const embeddableLinkCache = new Map<
  ExcalidrawEmbeddableElement["id"],
  string
>();

export const Hyperlink = ({
  element,
  scene,
  setAppState,
  onLinkOpen,
  setToast,
  updateEmbedValidationStatus,
}: {
  element: NonDeletedExcalidrawElement;
  scene: Scene;
  setAppState: React.Component<any, AppState>["setState"];
  onLinkOpen: ExcalidrawProps["onLinkOpen"];
  setToast: (
    toast: { message: string; closable?: boolean; duration?: number } | null,
  ) => void;
  updateEmbedValidationStatus: (
    element: ExcalidrawEmbeddableElement,
    status: boolean,
  ) => void;
}) => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const appState = useExcalidrawAppState();
  const appProps = useAppProps();
  const device = useDevice();

  const linkVal = element.link || "";

  const [inputVal, setInputVal] = useState(linkVal);
  const inputRef = useRef<HTMLInputElement>(null);
  const isEditing = appState.showHyperlinkPopup === "editor";

  const handleSubmit = useCallback(() => {
    if (!inputRef.current) {
      return;
    }

    const link = normalizeLink(inputRef.current.value) || null;

    if (!element.link && link) {
      trackEvent("hyperlink", "create");
    }

    if (isEmbeddableElement(element)) {
      if (appState.activeEmbeddable?.element === element) {
        setAppState({ activeEmbeddable: null });
      }
      if (!link) {
        scene.mutateElement(element, {
          link: null,
        });
        updateEmbedValidationStatus(element, false);
        return;
      }

      if (!embeddableURLValidator(link, appProps.validateEmbeddable)) {
        if (link) {
          setToast({ message: t("toast.unableToEmbed"), closable: true });
        }
        element.link && embeddableLinkCache.set(element.id, element.link);
        scene.mutateElement(element, {
          link,
        });
        updateEmbedValidationStatus(element, false);
      } else {
        const { width, height } = element;
        const embedLink = getEmbedLink(link);
        if (embedLink?.error instanceof URIError) {
          setToast({
            message: t("toast.unrecognizedLinkFormat"),
            closable: true,
          });
        }
        const ar = embedLink
          ? embedLink.intrinsicSize.w / embedLink.intrinsicSize.h
          : 1;
        const hasLinkChanged =
          embeddableLinkCache.get(element.id) !== element.link;
        scene.mutateElement(element, {
          ...(hasLinkChanged
            ? {
                width:
                  embedLink?.type === "video"
                    ? width > height
                      ? width
                      : height * ar
                    : width,
                height:
                  embedLink?.type === "video"
                    ? width > height
                      ? width / ar
                      : height
                    : height,
              }
            : {}),
          link,
        });
        updateEmbedValidationStatus(element, true);
        if (embeddableLinkCache.has(element.id)) {
          embeddableLinkCache.delete(element.id);
        }
      }
    } else {
      scene.mutateElement(element, { link });
    }
  }, [
    element,
    scene,
    setToast,
    appProps.validateEmbeddable,
    appState.activeEmbeddable,
    setAppState,
    updateEmbedValidationStatus,
  ]);

  useLayoutEffect(() => {
    return () => {
      handleSubmit();
    };
  }, [handleSubmit]);

  useEffect(() => {
    if (
      isEditing &&
      inputRef?.current &&
      !(device.viewport.isMobile || device.isTouchScreen)
    ) {
      inputRef.current.select();
    }
  }, [isEditing, device.viewport.isMobile, device.isTouchScreen]);

  useEffect(() => {
    let timeoutId: number | null = null;

    const handlePointerMove = (event: PointerEvent) => {
      if (isEditing) {
        return;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      const shouldHide = shouldHideLinkPopup(
        element,
        elementsMap,
        appState,
        pointFrom(event.clientX, event.clientY),
      ) as boolean;
      if (shouldHide) {
        timeoutId = window.setTimeout(() => {
          setAppState({ showHyperlinkPopup: false });
        }, AUTO_HIDE_TIMEOUT);
      }
    };
    window.addEventListener(EVENT.POINTER_MOVE, handlePointerMove, false);
    return () => {
      window.removeEventListener(EVENT.POINTER_MOVE, handlePointerMove, false);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [appState, element, isEditing, setAppState, elementsMap]);

  const handleRemove = useCallback(() => {
    trackEvent("hyperlink", "delete");
    scene.mutateElement(element, { link: null });
    setAppState({ showHyperlinkPopup: false });
  }, [setAppState, element, scene]);

  const onEdit = () => {
    trackEvent("hyperlink", "edit", "popup-ui");
    setAppState({ showHyperlinkPopup: "editor" });
  };
  const { x, y } = getCoordsForPopover(element, appState, elementsMap);
  if (
    appState.contextMenu ||
    appState.selectedElementsAreBeingDragged ||
    appState.resizingElement ||
    appState.isRotating ||
    appState.openMenu ||
    appState.viewModeEnabled
  ) {
    return null;
  }

  return (
    <div
      className="excalidraw-hyperlinkContainer"
      style={{
        top: `${y}px`,
        left: `${x}px`,
        width: POPUP_WIDTH,
        padding: POPUP_PADDING,
      }}
    >
      {isEditing ? (
        <input
          className={clsx("excalidraw-hyperlinkContainer-input")}
          placeholder={t("labels.link.hint")}
          ref={inputRef}
          value={inputVal}
          onChange={(event) => setInputVal(event.target.value)}
          autoFocus
          onKeyDown={(event) => {
            event.stopPropagation();
            // prevent cmd/ctrl+k shortcut when editing link
            if (event[KEYS.CTRL_OR_CMD] && event.key === KEYS.K) {
              event.preventDefault();
            }
            if (event.key === KEYS.ENTER || event.key === KEYS.ESCAPE) {
              handleSubmit();
              setAppState({ showHyperlinkPopup: "info" });
            }
          }}
        />
      ) : element.link ? (
        <a
          href={normalizeLink(element.link || "")}
          className="excalidraw-hyperlinkContainer-link"
          target={isLocalLink(element.link) ? "_self" : "_blank"}
          onClick={(event) => {
            if (element.link && onLinkOpen) {
              const customEvent = wrapEvent(
                EVENT.EXCALIDRAW_LINK,
                event.nativeEvent,
              );
              onLinkOpen(
                {
                  ...element,
                  link: normalizeLink(element.link),
                },
                customEvent,
              );
              if (customEvent.defaultPrevented) {
                event.preventDefault();
              }
            }
          }}
          rel="noopener noreferrer"
        >
          {element.link}
        </a>
      ) : (
        <div className="excalidraw-hyperlinkContainer-link">
          {t("labels.link.empty")}
        </div>
      )}
      <div className="excalidraw-hyperlinkContainer__buttons">
        {!isEditing && (
          <ToolButton
            type="button"
            title={t("buttons.edit")}
            aria-label={t("buttons.edit")}
            label={t("buttons.edit")}
            onClick={onEdit}
            className="excalidraw-hyperlinkContainer--edit"
            icon={FreedrawIcon}
          />
        )}
        <ToolButton
          type="button"
          title={t("labels.linkToElement")}
          aria-label={t("labels.linkToElement")}
          label={t("labels.linkToElement")}
          onClick={() => {
            setAppState({
              openDialog: {
                name: "elementLinkSelector",
                sourceElementId: element.id,
              },
            });
          }}
          icon={elementLinkIcon}
        />
        {linkVal && !isEmbeddableElement(element) && (
          <ToolButton
            type="button"
            title={t("buttons.remove")}
            aria-label={t("buttons.remove")}
            label={t("buttons.remove")}
            onClick={handleRemove}
            className="excalidraw-hyperlinkContainer--remove"
            icon={TrashIcon}
          />
        )}
      </div>
    </div>
  );
};

const getCoordsForPopover = (
  element: NonDeletedExcalidrawElement,
  appState: AppState,
  elementsMap: ElementsMap,
) => {
  const [x1, y1] = getElementAbsoluteCoords(element, elementsMap);
  const { x: viewportX, y: viewportY } = sceneCoordsToViewportCoords(
    { sceneX: x1 + element.width / 2, sceneY: y1 },
    appState,
  );
  const x = viewportX - appState.offsetLeft - POPUP_WIDTH / 2;
  const y = viewportY - appState.offsetTop - SPACE_BOTTOM;
  return { x, y };
};

export const getContextMenuLabel = (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: UIAppState,
) => {
  const selectedElements = getSelectedElements(elements, appState);
  const label = isEmbeddableElement(selectedElements[0])
    ? "labels.link.editEmbed"
    : selectedElements[0]?.link
    ? "labels.link.edit"
    : "labels.link.create";
  return label;
};

let HYPERLINK_TOOLTIP_TIMEOUT_ID: number | null = null;
export const showHyperlinkTooltip = (
  element: NonDeletedExcalidrawElement,
  appState: AppState,
  elementsMap: ElementsMap,
) => {
  if (HYPERLINK_TOOLTIP_TIMEOUT_ID) {
    clearTimeout(HYPERLINK_TOOLTIP_TIMEOUT_ID);
  }
  HYPERLINK_TOOLTIP_TIMEOUT_ID = window.setTimeout(
    () => renderTooltip(element, appState, elementsMap),
    HYPERLINK_TOOLTIP_DELAY,
  );
};

const renderTooltip = (
  element: NonDeletedExcalidrawElement,
  appState: AppState,
  elementsMap: ElementsMap,
) => {
  if (!element.link) {
    return;
  }

  const tooltipDiv = getTooltipDiv();

  tooltipDiv.classList.add("excalidraw-tooltip--visible");
  tooltipDiv.style.maxWidth = "20rem";
  tooltipDiv.textContent = isElementLink(element.link)
    ? t("labels.link.goToElement")
    : element.link;

  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);

  const [linkX, linkY, linkWidth, linkHeight] = getLinkHandleFromCoords(
    [x1, y1, x2, y2],
    element.angle,
    appState,
  );

  const linkViewportCoords = sceneCoordsToViewportCoords(
    { sceneX: linkX, sceneY: linkY },
    appState,
  );

  updateTooltipPosition(
    tooltipDiv,
    {
      left: linkViewportCoords.x,
      top: linkViewportCoords.y,
      width: linkWidth,
      height: linkHeight,
    },
    "top",
  );
  trackEvent("hyperlink", "tooltip", "link-icon");

  IS_HYPERLINK_TOOLTIP_VISIBLE = true;
};
export const hideHyperlinkToolip = () => {
  if (HYPERLINK_TOOLTIP_TIMEOUT_ID) {
    clearTimeout(HYPERLINK_TOOLTIP_TIMEOUT_ID);
  }
  if (IS_HYPERLINK_TOOLTIP_VISIBLE) {
    IS_HYPERLINK_TOOLTIP_VISIBLE = false;
    getTooltipDiv().classList.remove("excalidraw-tooltip--visible");
  }
};

const shouldHideLinkPopup = (
  element: NonDeletedExcalidrawElement,
  elementsMap: ElementsMap,
  appState: AppState,
  [clientX, clientY]: GlobalPoint,
): Boolean => {
  const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
    { clientX, clientY },
    appState,
  );

  const threshold = 15 / appState.zoom.value;
  // hitbox to prevent hiding when hovered in element bounding box
  if (hitElementBoundingBox(sceneX, sceneY, element, elementsMap)) {
    return false;
  }
  const [x1, y1, x2] = getElementAbsoluteCoords(element, elementsMap);
  // hit box to prevent hiding when hovered in the vertical area between element and popover
  if (
    sceneX >= x1 &&
    sceneX <= x2 &&
    sceneY >= y1 - SPACE_BOTTOM &&
    sceneY <= y1
  ) {
    return false;
  }
  // hit box to prevent hiding when hovered around popover within threshold
  const { x: popoverX, y: popoverY } = getCoordsForPopover(
    element,
    appState,
    elementsMap,
  );

  if (
    clientX >= popoverX - threshold &&
    clientX <= popoverX + POPUP_WIDTH + POPUP_PADDING * 2 + threshold &&
    clientY >= popoverY - threshold &&
    clientY <= popoverY + threshold + POPUP_PADDING * 2 + POPUP_HEIGHT
  ) {
    return false;
  }
  return true;
};
