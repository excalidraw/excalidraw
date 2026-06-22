import {
  CODE_BLOCK_PADDING,
  CaptureUpdateAction,
  findCodeBlockContainer,
  isCodeBlockTextElement,
  measureCodeBlockText,
  newElementWith,
} from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { codeIcon, textWrapIcon } from "../components/icons";
import { ToolButton } from "../components/ToolButton";
import { t } from "../i18n";
import { getSelectedElements } from "../scene";

import { register } from "./register";

export const actionInsertCodeBlock = register({
  name: "insertCodeBlock",
  icon: codeIcon,
  keywords: ["code", "snippet", "syntax", "highlight", "programming"],
  label: "toolBar.codeBlock",
  viewMode: false,
  trackEvent: { category: "toolbar" },
  perform: (elements, appState) => {
    return {
      elements,
      appState: {
        ...appState,
        openDialog: { name: "codeBlock" },
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  predicate: (_elements, _appState, props) => props.viewModeEnabled !== true,
});

export const actionToggleCodeBlockWrap = register({
  name: "toggleCodeBlockWrap",
  icon: textWrapIcon,
  label: "codeBlock.wrap",
  trackEvent: { category: "element" },
  perform: (elements, appState) => {
    const selected = getSelectedElements(elements, appState, {
      includeBoundTextElement: true,
    });
    const codeBlockTexts = selected.filter(isCodeBlockTextElement);
    if (codeBlockTexts.length === 0) {
      return false;
    }

    // toggle relative to the first selected block's current state
    const nextWrap = !codeBlockTexts[0].customData.codeBlock.wrap;

    const replacements = new Map<string, ExcalidrawElement>();
    for (const text of codeBlockTexts) {
      const container = findCodeBlockContainer(elements, text);
      if (!container) {
        continue;
      }
      const meta = text.customData.codeBlock;
      const metrics = measureCodeBlockText(text.text, {
        fontSize: text.fontSize,
        wrap: nextWrap,
        maxWidth: nextWrap ? text.width : undefined,
      });

      replacements.set(
        text.id,
        newElementWith(text, {
          width: metrics.width,
          height: metrics.height,
          customData: { codeBlock: { ...meta, wrap: nextWrap } },
        }),
      );
      replacements.set(
        container.id,
        newElementWith(container, {
          width: metrics.width + CODE_BLOCK_PADDING * 2,
          height: metrics.height + CODE_BLOCK_PADDING * 2,
        }),
      );
    }

    if (replacements.size === 0) {
      return false;
    }

    return {
      elements: elements.map((el) => replacements.get(el.id) ?? el),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  predicate: (elements, appState) =>
    getSelectedElements(elements, appState, {
      includeBoundTextElement: true,
    }).some(isCodeBlockTextElement),
  PanelComponent: ({ elements, appState, updateData }) => {
    const codeBlockText = getSelectedElements(elements, appState, {
      includeBoundTextElement: true,
    }).find(isCodeBlockTextElement);
    const wrap = !!codeBlockText?.customData.codeBlock.wrap;

    return (
      <ToolButton
        type="button"
        icon={textWrapIcon}
        title={t("codeBlock.wrap")}
        aria-label={t("codeBlock.wrap")}
        onClick={() => updateData(null)}
        selected={wrap}
      />
    );
  },
});
