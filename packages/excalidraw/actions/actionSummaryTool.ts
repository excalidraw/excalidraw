import {
  CaptureUpdateAction,
  isTextElement,
  newElementWith,
} from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { t } from "../i18n";
import { getSelectedElements } from "../scene";
import { applySummaryToolSync } from "../summaryTool/summaryTool";

import { register } from "./register";

import type { AppState } from "../types";

const getSummaryToolData = (element: ExcalidrawElement) => {
  const customData = (element.customData ?? {}) as Record<string, any>;
  const data = customData.summaryTool;
  return data && typeof data === "object"
    ? (data as Record<string, any>)
    : null;
};

const setSummaryToolData = (
  element: ExcalidrawElement,
  next: Record<string, any> | null,
) => {
  const prevCustomData = (element.customData ?? {}) as Record<string, any>;
  if (!next) {
    const { summaryTool: _removed, ...rest } = prevCustomData;
    return newElementWith(element as any, {
      customData: Object.keys(rest).length ? rest : undefined,
    });
  }
  return newElementWith(element as any, {
    customData: {
      ...prevCustomData,
      summaryTool: next,
    },
  });
};

const clearRole = (
  element: ExcalidrawElement,
  role: "summaryRoot" | "summaryBase",
) => {
  const prev = getSummaryToolData(element);
  if (!prev || prev.role !== role) {
    return element;
  }
  const { role: _r, ...rest } = prev;
  const next = Object.keys(rest).length ? rest : null;
  return setSummaryToolData(element, next);
};

const setRole = (
  element: ExcalidrawElement,
  role: "summaryRoot" | "summaryBase",
) => {
  const prev = getSummaryToolData(element) ?? {};
  return setSummaryToolData(element, { ...prev, role });
};

const setCommentsDisplayMode = (
  element: ExcalidrawElement,
  mode: "off" | "single" | "all",
) => {
  const prev = getSummaryToolData(element) ?? {};
  return setSummaryToolData(element, { ...prev, commentsDisplayMode: mode });
};

export const actionToggleSummaryRoot = register({
  name: "summaryToolToggleSummaryRoot",
  trackEvent: false,
  label: (elements, appState) => {
    const selected = getSelectedElements(elements, appState);
    const el = selected[0];
    const data = el ? getSummaryToolData(el) : null;
    return data?.role === "summaryRoot"
      ? ("summaryTool.unsetSummaryRoot" as any)
      : ("summaryTool.setSummaryRoot" as any);
  },
  perform: (elements, appState, _, app) => {
    const selected = getSelectedElements(elements, appState);
    if (selected.length !== 1 || !isTextElement(selected[0])) {
      return false;
    }
    const target = selected[0];
    const isAlreadyRoot = getSummaryToolData(target)?.role === "summaryRoot";

    const nextElements = elements.map((el) => {
      if (!isTextElement(el) || el.isDeleted) {
        return el;
      }
      const cleared = clearRole(el, "summaryRoot");
      if (el.id === target.id) {
        return isAlreadyRoot ? cleared : setRole(cleared, "summaryRoot");
      }
      return cleared;
    });

    const elementsMap = new Map(
      nextElements
        .filter((el) => !el.isDeleted)
        .map((el) => [el.id, el] as const),
    ) as any;

    const sync = applySummaryToolSync({
      elements: nextElements,
      appState: { ...appState, textLineLinks: appState.textLineLinks } as any,
      elementsMap,
    });

    app.setAppState({
      toast: {
        message: isAlreadyRoot
          ? t("summaryTool.unsetSummaryRootToast")
          : t("summaryTool.setSummaryRootToast"),
        duration: 1500,
      },
    });

    return {
      elements: sync.elements,
      appState: {
        ...appState,
        ...sync.appState,
        contextMenu: null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  predicate: (elements, appState) => {
    const selected = getSelectedElements(elements, appState);
    return selected.length === 1 && isTextElement(selected[0]);
  },
  checked: (appState: AppState) => {
    return false;
  },
});

export const actionToggleSummaryBase = register({
  name: "summaryToolToggleSummaryBase",
  trackEvent: false,
  label: (elements, appState) => {
    const selected = getSelectedElements(elements, appState);
    const el = selected[0];
    const data = el ? getSummaryToolData(el) : null;
    return data?.role === "summaryBase"
      ? ("summaryTool.unsetSummaryBase" as any)
      : ("summaryTool.setSummaryBase" as any);
  },
  perform: (elements, appState, _, app) => {
    const selected = getSelectedElements(elements, appState);
    if (selected.length !== 1 || !isTextElement(selected[0])) {
      return false;
    }
    const target = selected[0];
    const isAlreadyBase = getSummaryToolData(target)?.role === "summaryBase";

    const nextElements = elements.map((el) => {
      if (!isTextElement(el) || el.isDeleted) {
        return el;
      }
      const cleared = clearRole(el, "summaryBase");
      if (el.id === target.id) {
        return isAlreadyBase ? cleared : setRole(cleared, "summaryBase");
      }
      return cleared;
    });

    const elementsMap = new Map(
      nextElements
        .filter((el) => !el.isDeleted)
        .map((el) => [el.id, el] as const),
    ) as any;

    const sync = applySummaryToolSync({
      elements: nextElements,
      appState: { ...appState, textLineLinks: appState.textLineLinks } as any,
      elementsMap,
    });

    app.setAppState({
      toast: {
        message: isAlreadyBase
          ? t("summaryTool.unsetSummaryBaseToast")
          : t("summaryTool.setSummaryBaseToast"),
        duration: 1500,
      },
    });

    return {
      elements: sync.elements,
      appState: {
        ...appState,
        ...sync.appState,
        contextMenu: null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  predicate: (elements, appState) => {
    const selected = getSelectedElements(elements, appState);
    return selected.length === 1 && isTextElement(selected[0]);
  },
  checked: (appState: AppState) => {
    return false;
  },
});

export const actionSummaryToolCommentsOff = register({
  name: "summaryToolCommentsOff",
  trackEvent: false,
  label: "summaryTool.commentsOff",
  perform: (elements, appState, _, app) => {
    const selected = getSelectedElements(elements, appState);
    if (selected.length !== 1 || !isTextElement(selected[0])) {
      return false;
    }
    const target = selected[0];
    if (getSummaryToolData(target)?.role !== "summaryRoot") {
      return false;
    }

    const nextElements = elements.map((el) =>
      el.id === target.id ? setCommentsDisplayMode(el, "off") : el,
    );

    const elementsMap = new Map(
      nextElements
        .filter((el) => !el.isDeleted)
        .map((el) => [el.id, el] as const),
    ) as any;

    const sync = applySummaryToolSync({
      elements: nextElements,
      appState: { ...appState, textLineLinks: appState.textLineLinks } as any,
      elementsMap,
    });

    return {
      elements: sync.elements,
      appState: {
        ...appState,
        ...sync.appState,
        contextMenu: null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  predicate: (elements, appState) => {
    const selected = getSelectedElements(elements, appState);
    return (
      selected.length === 1 &&
      isTextElement(selected[0]) &&
      getSummaryToolData(selected[0])?.role === "summaryRoot"
    );
  },
});

export const actionSummaryToolCommentsSingle = register({
  name: "summaryToolCommentsSingle",
  trackEvent: false,
  label: "summaryTool.commentsSingle",
  perform: (elements, appState, _, app) => {
    const selected = getSelectedElements(elements, appState);
    if (selected.length !== 1 || !isTextElement(selected[0])) {
      return false;
    }
    const target = selected[0];
    if (getSummaryToolData(target)?.role !== "summaryRoot") {
      return false;
    }

    const nextElements = elements.map((el) =>
      el.id === target.id ? setCommentsDisplayMode(el, "single") : el,
    );

    const elementsMap = new Map(
      nextElements
        .filter((el) => !el.isDeleted)
        .map((el) => [el.id, el] as const),
    ) as any;

    const sync = applySummaryToolSync({
      elements: nextElements,
      appState: { ...appState, textLineLinks: appState.textLineLinks } as any,
      elementsMap,
    });

    return {
      elements: sync.elements,
      appState: {
        ...appState,
        ...sync.appState,
        contextMenu: null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  predicate: (elements, appState) => {
    const selected = getSelectedElements(elements, appState);
    return (
      selected.length === 1 &&
      isTextElement(selected[0]) &&
      getSummaryToolData(selected[0])?.role === "summaryRoot"
    );
  },
});

export const actionSummaryToolCommentsAll = register({
  name: "summaryToolCommentsAll",
  trackEvent: false,
  label: "summaryTool.commentsAll",
  perform: (elements, appState, _, app) => {
    const selected = getSelectedElements(elements, appState);
    if (selected.length !== 1 || !isTextElement(selected[0])) {
      return false;
    }
    const target = selected[0];
    if (getSummaryToolData(target)?.role !== "summaryRoot") {
      return false;
    }

    const nextElements = elements.map((el) =>
      el.id === target.id ? setCommentsDisplayMode(el, "all") : el,
    );

    const elementsMap = new Map(
      nextElements
        .filter((el) => !el.isDeleted)
        .map((el) => [el.id, el] as const),
    ) as any;

    const sync = applySummaryToolSync({
      elements: nextElements,
      appState: { ...appState, textLineLinks: appState.textLineLinks } as any,
      elementsMap,
    });

    return {
      elements: sync.elements,
      appState: {
        ...appState,
        ...sync.appState,
        contextMenu: null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  predicate: (elements, appState) => {
    const selected = getSelectedElements(elements, appState);
    return (
      selected.length === 1 &&
      isTextElement(selected[0]) &&
      getSummaryToolData(selected[0])?.role === "summaryRoot"
    );
  },
});
