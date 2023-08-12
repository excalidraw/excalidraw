import { AppState, ExcalidrawProps, Point, UIAppState } from "../types";
import {
  getShortcutKey,
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
  wrapEvent,
} from "../utils";
import { getEmbedLink, embeddableURLValidator } from "./embeddable";
import { mutateElement } from "./mutateElement";
import {
  ExcalidrawEmbeddableElement,
  NonDeletedExcalidrawElement,
} from "./types";

import { register } from "../actions/register";
import { ToolButton } from "../components/ToolButton";
import { FreedrawIcon, LinkIcon, TrashIcon } from "../components/icons";
import { t } from "../i18n";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import clsx from "clsx";
import { KEYS } from "../keys";
import { DEFAULT_LINK_SIZE } from "../renderer/renderElement";
import { rotate } from "../math";
import { EVENT, HYPERLINK_TOOLTIP_DELAY, MIME_TYPES } from "../constants";
import { Bounds } from "./bounds";
import { getTooltipDiv, updateTooltipPosition } from "../components/Tooltip";
import { getSelectedElements } from "../scene";
import { isPointHittingElementBoundingBox } from "./collision";
import { getElementAbsoluteCoords } from "./";
import { isLocalLink, normalizeLink } from "../data/url";

import "./Hyperlink.scss";
import { trackEvent } from "../analytics";
import { useAppProps, useExcalidrawAppState } from "../components/App";
import { isEmbeddableElement } from "./typeChecks";
import { ShapeCache } from "../scene/ShapeCache";

const CONTAINER_WIDTH = 320;
const SPACE_BOTTOM = 85;
const CONTAINER_PADDING = 5;
const CONTAINER_HEIGHT = 42;
const AUTO_HIDE_TIMEOUT = 500;

export const EXTERNAL_LINK_IMG = document.createElement("img");
EXTERNAL_LINK_IMG.src = `data:${MIME_TYPES.svg}, ${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1971c2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-external-link"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`,
)}`;

let IS_HYPERLINK_TOOLTIP_VISIBLE = false;

const embeddableLinkCache = new Map<
  ExcalidrawEmbeddableElement["id"],
  string
>();

export const Hyperlink = ({
  element,
  setAppState,
  onLinkOpen,
  setToast,
}: {
  element: NonDeletedExcalidrawElement;
  setAppState: React.Component<any, AppState>["setState"];
  onLinkOpen: ExcalidrawProps["onLinkOpen"];
  setToast: (
    toast: { message: string; closable?: boolean; duration?: number } | null,
  ) => void;
}) => {
  const appState = useExcalidrawAppState();
  const appProps = useAppProps();

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
        mutateElement(element, {
          validated: false,
          link: null,
        });
        return;
      }

      if (!embeddableURLValidator(link, appProps.validateEmbeddable)) {
        if (link) {
          setToast({ message: t("toast.unableToEmbed"), closable: true });
        }
        element.link && embeddableLinkCache.set(element.id, element.link);
        mutateElement(element, {
          validated: false,
          link,
        });
        ShapeCache.delete(element);
      } else {
        const { width, height } = element;
        const embedLink = getEmbedLink(link);
        if (embedLink?.warning) {
          setToast({ message: embedLink.warning, closable: true });
        }
        const ar = embedLink
          ? embedLink.aspectRatio.w / embedLink.aspectRatio.h
          : 1;
        const hasLinkChanged =
          embeddableLinkCache.get(element.id) !== element.link;
        mutateElement(element, {
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
          validated: true,
          link,
        });
        ShapeCache.delete(element);
        if (embeddableLinkCache.has(element.id)) {
          embeddableLinkCache.delete(element.id);
        }
      }
    } else {
      mutateElement(element, { link });
    }
  }, [
    element,
    setToast,
    appProps.validateEmbeddable,
    appState.activeEmbeddable,
    setAppState,
  ]);

  useLayoutEffect(() => {
    return () => {
      handleSubmit();
    };
  }, [handleSubmit]);

  useEffect(() => {
    let timeoutId: number | null = null;
    const handlePointerMove = (event: PointerEvent) => {
      if (isEditing) {
        return;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      const shouldHide = shouldHideLinkPopup(element, appState, [
        event.clientX,
        event.clientY,
      ]) as boolean;
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
  }, [appState, element, isEditing, setAppState]);

  const handleRemove = useCallback(() => {
    trackEvent("hyperlink", "delete");
    mutateElement(element, { link: null });
    if (isEditing) {
      inputRef.current!.value = "";
    }
    setAppState({ showHyperlinkPopup: false });
  }, [setAppState, element, isEditing]);

  const onEdit = () => {
    trackEvent("hyperlink", "edit", "popup-ui");
    setAppState({ showHyperlinkPopup: "editor" });
  };
  const { x, y } = getCoordsForPopover(element, appState);
  if (
    appState.draggingElement ||
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
        width: CONTAINER_WIDTH,
        padding: CONTAINER_PADDING,
      }}
      onClick={() => {
        if (!element.link && !isEditing) {
          setAppState({ showHyperlinkPopup: "editor" });
        }
      }}
    >
      {isEditing ? (
        <input
          className={clsx("excalidraw-hyperlinkContainer-input")}
          placeholder="Type or paste your link here"
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
) => {
  const [x1, y1] = getElementAbsoluteCoords(element);
  const { x: viewportX, y: viewportY } = sceneCoordsToViewportCoords(
    { sceneX: x1 + element.width / 2, sceneY: y1 },
    appState,
  );
  const x = viewportX - appState.offsetLeft - CONTAINER_WIDTH / 2;
  const y = viewportY - appState.offsetTop - SPACE_BOTTOM;
  return { x, y };
};

export const actionLink = register({
  name: "hyperlink",
  perform: (elements, appState) => {
    if (appState.showHyperlinkPopup === "editor") {
      return false;
    }

    return {
      elements,
      appState: {
        ...appState,
        showHyperlinkPopup: "editor",
        openMenu: null,
      },
      commitToHistory: true,
    };
  },
  trackEvent: { category: "hyperlink", action: "click" },
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === KEYS.K,
  contextItemLabel: (elements, appState) =>
    getContextMenuLabel(elements, appState),
  predicate: (elements, appState) => {
    const selectedElements = getSelectedElements(elements, appState);
    return selectedElements.length === 1;
  },
  PanelComponent: ({ elements, appState, updateData }) => {
    const selectedElements = getSelectedElements(elements, appState);

    return (
      <ToolButton
        type="button"
        icon={LinkIcon}
        aria-label={t(getContextMenuLabel(elements, appState))}
        title={`${
          isEmbeddableElement(elements[0])
            ? t("labels.link.labelEmbed")
            : t("labels.link.label")
        } - ${getShortcutKey("CtrlOrCmd+K")}`}
        onClick={() => updateData(null)}
        selected={selectedElements.length === 1 && !!selectedElements[0].link}
      />
    );
  },
});

export const getContextMenuLabel = (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
) => {
  const selectedElements = getSelectedElements(elements, appState);
  const label = selectedElements[0]!.link
    ? isEmbeddableElement(selectedElements[0])
      ? "labels.link.editEmbed"
      : "labels.link.edit"
    : isEmbeddableElement(selectedElements[0])
    ? "labels.link.createEmbed"
    : "labels.link.create";
  return label;
};

export const getLinkHandleFromCoords = (
  [x1, y1, x2, y2]: Bounds,
  angle: number,
  appState: Pick<UIAppState, "zoom">,
): [x: number, y: number, width: number, height: number] => {
  const size = DEFAULT_LINK_SIZE;
  const linkWidth = size / appState.zoom.value;
  const linkHeight = size / appState.zoom.value;
  const linkMarginY = size / appState.zoom.value;
  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;
  const centeringOffset = (size - 8) / (2 * appState.zoom.value);
  const dashedLineMargin = 4 / appState.zoom.value;

  // Same as `ne` resize handle
  const x = x2 + dashedLineMargin - centeringOffset;
  const y = y1 - dashedLineMargin - linkMarginY + centeringOffset;

  const [rotatedX, rotatedY] = rotate(
    x + linkWidth / 2,
    y + linkHeight / 2,
    centerX,
    centerY,
    angle,
  );
  return [
    rotatedX - linkWidth / 2,
    rotatedY - linkHeight / 2,
    linkWidth,
    linkHeight,
  ];
};

export const isPointHittingLinkIcon = (
  element: NonDeletedExcalidrawElement,
  appState: AppState,
  [x, y]: Point,
) => {
  const threshold = 4 / appState.zoom.value;
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
  const [linkX, linkY, linkWidth, linkHeight] = getLinkHandleFromCoords(
    [x1, y1, x2, y2],
    element.angle,
    appState,
  );
  const hitLink =
    x > linkX - threshold &&
    x < linkX + threshold + linkWidth &&
    y > linkY - threshold &&
    y < linkY + linkHeight + threshold;
  return hitLink;
};

export const isPointHittingLink = (
  element: NonDeletedExcalidrawElement,
  appState: AppState,
  [x, y]: Point,
  isMobile: boolean,
) => {
  if (!element.link || appState.selectedElementIds[element.id]) {
    return false;
  }
  const threshold = 4 / appState.zoom.value;
  if (
    !isMobile &&
    appState.viewModeEnabled &&
    isPointHittingElementBoundingBox(element, [x, y], threshold, null)
  ) {
    return true;
  }
  return isPointHittingLinkIcon(element, appState, [x, y]);
};

let HYPERLINK_TOOLTIP_TIMEOUT_ID: number | null = null;
export const showHyperlinkTooltip = (
  element: NonDeletedExcalidrawElement,
  appState: AppState,
) => {
  if (HYPERLINK_TOOLTIP_TIMEOUT_ID) {
    clearTimeout(HYPERLINK_TOOLTIP_TIMEOUT_ID);
  }
  HYPERLINK_TOOLTIP_TIMEOUT_ID = window.setTimeout(
    () => renderTooltip(element, appState),
    HYPERLINK_TOOLTIP_DELAY,
  );
};

const renderTooltip = (
  element: NonDeletedExcalidrawElement,
  appState: AppState,
) => {
  if (!element.link) {
    return;
  }

  const tooltipDiv = getTooltipDiv();

  tooltipDiv.classList.add("excalidraw-tooltip--visible");
  tooltipDiv.style.maxWidth = "20rem";
  tooltipDiv.textContent = element.link;

  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);

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

export const shouldHideLinkPopup = (
  element: NonDeletedExcalidrawElement,
  appState: AppState,
  [clientX, clientY]: Point,
): Boolean => {
  const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
    { clientX, clientY },
    appState,
  );

  const threshold = 15 / appState.zoom.value;
  // hitbox to prevent hiding when hovered in element bounding box
  if (
    isPointHittingElementBoundingBox(element, [sceneX, sceneY], threshold, null)
  ) {
    return false;
  }
  const [x1, y1, x2] = getElementAbsoluteCoords(element);
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
  const { x: popoverX, y: popoverY } = getCoordsForPopover(element, appState);

  if (
    clientX >= popoverX - threshold &&
    clientX <= popoverX + CONTAINER_WIDTH + CONTAINER_PADDING * 2 + threshold &&
    clientY >= popoverY - threshold &&
    clientY <= popoverY + threshold + CONTAINER_PADDING * 2 + CONTAINER_HEIGHT
  ) {
    return false;
  }
  return true;
};
