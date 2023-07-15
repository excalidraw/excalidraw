import { register } from "../actions/register";
import { FONT_FAMILY, VERTICAL_ALIGN } from "../constants";
import { KEYS } from "../keys";
import { ExcalidrawProps } from "../types";
import { getFontString, setCursorForShape, updateActiveTool } from "../utils";
import { newTextElement } from "./newElement";
import { getContainerElement, wrapText } from "./textElement";
import { isEmbeddableElement } from "./typeChecks";
import {
  ExcalidrawElement,
  ExcalidrawEmbeddableElement,
  NonDeletedExcalidrawElement,
} from "./types";

type EmbeddedLink = {
  link: string;
  aspectRatio: { w: number; h: number };
  type: "video" | "generic";
} | null;

const embeddedLinkCache = new Map<string, EmbeddedLink>();

const YOUTUBE_REG =
  /^(?:http(?:s)?:\/\/)?(?:(?:w){3}.)?youtu(?:be|.be)?(?:\.com)?\/(embed\/|watch\?v=|shorts\/|playlist\?list=|embed\/videoseries\?list=)?([a-zA-Z0-9_-]+)(?:\?t=|&t=)?([a-zA-Z0-9_-]+)?[^\s]*$/;
const VIMEO_REG =
  /^(?:http(?:s)?:\/\/)?(?:(?:w){3}.)?(?:player\.)?vimeo\.com\/(?:video\/)?([^?\s]+)(?:\?.*)?$/;
//const TWITTER_REG = /^(?:http(?:s)?:\/\/)?(?:(?:w){3}.)?twitter.com/;
const FIGMA_REG = /^https:\/\/www\.figma\.com/;
//const EXCALIDRAW_REG = /^https:\/\/excalidraw.com/;

export const getEmbedLink = (link?: string | null): EmbeddedLink => {
  if (!link) {
    return null;
  }

  if (embeddedLinkCache.has(link)) {
    return embeddedLinkCache.get(link)!;
  }

  let type: "video" | "generic" = "generic";
  let aspectRatio = { w: 560, h: 840 };
  const ytLink = link.match(YOUTUBE_REG);
  if (ytLink?.[2]) {
    const time = ytLink[3] ? `&t=${ytLink[3]}` : ``;
    const isPortrait = link.includes("shorts");
    type = "video";
    switch (ytLink[1]) {
      case "embed/":
      case "watch?v=":
      case "shorts/":
        link = `https://www.youtube.com/embed/${ytLink[2]}?enablejsapi=1${time}`;
        break;
      case "playlist?list=":
      case "embed/videoseries?list=":
        link = `https://www.youtube.com/embed/videoseries?list=${ytLink[2]}&enablejsapi=1${time}`;
        break;
      default:
        link = `https://www.youtube.com/embed/${ytLink[2]}?enablejsapi=1${time}`;
        break;
    }
    aspectRatio = isPortrait ? { w: 315, h: 560 } : { w: 560, h: 315 };
    embeddedLinkCache.set(link, { link, aspectRatio, type });
    return { link, aspectRatio, type };
  }

  const vimeoLink = link.match(VIMEO_REG);
  if (vimeoLink?.[1]) {
    const target = vimeoLink?.[1];
    type = "video";
    link = `https://player.vimeo.com/video/${target}?api=1`;
    aspectRatio = { w: 560, h: 315 };
    embeddedLinkCache.set(link, { link, aspectRatio, type });
    return { link, aspectRatio, type };
  }

  /*const twitterLink = link.match(TWITTER_REG);
  if (twitterLink) {
    type = "generic";
    link = `https://twitframe.com/show?url=${encodeURIComponent(link)}`;
    aspectRatio = { w: 550, h: 550 };
    embeddedLinkCache.set(link, { link, aspectRatio, type });
    return { link, aspectRatio, type };
  }*/

  const figmaLink = link.match(FIGMA_REG);
  if (figmaLink) {
    type = "generic";
    link = `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(
      link,
    )}`;
    aspectRatio = { w: 550, h: 550 };
    embeddedLinkCache.set(link, { link, aspectRatio, type });
    return { link, aspectRatio, type };
  }

  embeddedLinkCache.set(link, { link, aspectRatio, type });
  return { link, aspectRatio, type };
};

export const isEmbeddableOrFrameLabel = (
  element: NonDeletedExcalidrawElement,
): Boolean => {
  if (isEmbeddableElement(element)) {
    return true;
  }
  if (element.type === "text") {
    const container = getContainerElement(element);
    if (container && isEmbeddableElement(container)) {
      return true;
    }
  }
  return false;
};

export const createPlaceholderEmbeddableLabel = (
  element: ExcalidrawEmbeddableElement,
): ExcalidrawElement => {
  const text =
    !element.link || element?.link === "" ? "Empty Web-Embed" : element.link;
  const fontSize = Math.max(
    Math.min(element.width / 2, element.width / text.length),
    element.width / 30,
  );
  const fontFamily = FONT_FAMILY.Helvetica;

  const fontString = getFontString({
    fontSize,
    fontFamily,
  });

  return newTextElement({
    x: element.x + element.width / 2,
    y: element.y + element.height / 2,
    strokeColor:
      element.strokeColor !== "transparent" ? element.strokeColor : "black",
    backgroundColor: "transparent",
    fontFamily,
    fontSize,
    text: wrapText(text, fontString, element.width - 20),
    rawText: text,
    textAlign: "center",
    verticalAlign: VERTICAL_ALIGN.MIDDLE,
    angle: element.angle ?? 0,
  });
};

export const actionSetEmbeddableAsActiveTool = register({
  name: "setEmbeddableAsActiveTool",
  trackEvent: { category: "toolbar" },
  perform: (elements, appState, _, app) => {
    const nextActiveTool = updateActiveTool(appState, {
      type: "embeddable",
    });

    setCursorForShape(app.canvas, {
      ...appState,
      activeTool: nextActiveTool,
    });

    return {
      elements,
      appState: {
        ...appState,
        activeTool: updateActiveTool(appState, {
          type: "embeddable",
        }),
      },
      commitToHistory: false,
    };
  },
  keyTest: (event) => event.key.toLocaleLowerCase() === KEYS.W,
});

export const embeddableURLValidator = (
  url: string | null | undefined,
  validateEmbeddable: ExcalidrawProps["validateEmbeddable"],
): boolean => {
  if (!url) {
    return false;
  }
  if (validateEmbeddable != null) {
    if (typeof validateEmbeddable === "function") {
      const ret = validateEmbeddable(url);
      // if return value is undefined, leave validation to default
      if (typeof ret === "boolean") {
        return ret;
      }
    } else if (typeof validateEmbeddable === "boolean") {
      return validateEmbeddable;
    } else if (validateEmbeddable instanceof RegExp) {
      return validateEmbeddable.test(url);
    } else if (Array.isArray(validateEmbeddable)) {
      for (const regex of validateEmbeddable) {
        if (url.match(regex)) {
          return true;
        }
      }
      return false;
    }
  }
  return Boolean(
    url.match(YOUTUBE_REG) || url.match(VIMEO_REG) || url.match(FIGMA_REG),
  );
};
