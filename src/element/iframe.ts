import { register } from "../actions/register";
import { FONT_FAMILY, VERTICAL_ALIGN } from "../constants";
import { KEYS } from "../keys";
import { ExcalidrawProps } from "../types";
import { setCursorForShape, updateActiveTool } from "../utils";
import { newTextElement } from "./newElement";
import { getContainerElement } from "./textElement";
import { isIFrameElement } from "./typeChecks";
import { ExcalidrawElement, NonDeletedExcalidrawElement } from "./types";

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

export const hideActionForIFrame = (
  element: ExcalidrawElement | undefined,
  props: ExcalidrawProps,
) =>
  isIFrameElement(element) &&
  element.link &&
  element.link !== "" &&
  !props.validateIFrame;

export const isIFrameOrFrameLabel = (
  element: NonDeletedExcalidrawElement,
): Boolean => {
  if (isIFrameElement(element)) {
    return true;
  }
  if (element.type === "text") {
    const container = getContainerElement(element);
    if (container && isIFrameElement(container)) {
      return true;
    }
  }
  return false;
};

export const createPlaceholderiFrameLabel = (
  element: NonDeletedExcalidrawElement,
): ExcalidrawElement => {
  const text =
    !element.link || element?.link === "" ? "Empty Web-Embed" : element.link;
  const fontSize = element.width / text.length;
  return newTextElement({
    x: element.x + element.width / 2,
    y: element.y + element.height / 2,
    strokeColor:
      element.strokeColor !== "transparent" ? element.strokeColor : "black",
    backgroundColor: "transparent",
    fontFamily: FONT_FAMILY.Helvetica,
    fontSize,
    text,
    textAlign: "center",
    verticalAlign: VERTICAL_ALIGN.MIDDLE,
    angle: element.angle ?? 0,
  });
};

export const actionSetIFrameAsActiveTool = register({
  name: "setIFrameAsActiveTool",
  trackEvent: { category: "toolbar" },
  perform: (elements, appState, _, app) => {
    const nextActiveTool = updateActiveTool(appState, {
      type: "iframe",
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
          type: "iframe",
        }),
      },
      commitToHistory: false,
    };
  },
  keyTest: (event) => event.key.toLocaleLowerCase() === KEYS.W,
});

export const iframeURLValidator = (
  url: string | null | undefined,
  validateIFrame: ExcalidrawProps["validateIFrame"],
): boolean => {
  if (!url) {
    return false;
  }
  if (validateIFrame != null) {
    if (typeof validateIFrame === "function") {
      const ret = validateIFrame(url);
      // if return value is undefined, leave validation to default
      if (typeof ret === "boolean") {
        return ret;
      }
    } else if (typeof validateIFrame === "boolean") {
      return validateIFrame;
    } else if (validateIFrame instanceof RegExp) {
      return validateIFrame.test(url);
    } else if (Array.isArray(validateIFrame)) {
      for (const regex of validateIFrame) {
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
