import { FONT_FAMILY, VERTICAL_ALIGN } from "../constants";
import { newTextElement } from "./newElement";
import { getContainerElement } from "./textElement";
import { isIFrameElement } from "./typeChecks";
import { ExcalidrawElement, NonDeletedExcalidrawElement } from "./types";

const YOUTUBE_REG =
  /^(?:http(?:s)?:\/\/)?(?:(?:w){3}.)?youtu(?:be|.be)?(?:\.com)?\/(?:embed\/|watch\?v=|shorts\/)?([a-zA-Z0-9_-]+)(?:\?t=|&t=)?([a-zA-Z0-9_-]+)?[^\s]*$/;
const VIMEO_REG =
  /^(?:http(?:s)?:\/\/)?(?:(?:w){3}.)?(?:player\.)?vimeo\.com\/(?:video\/)?([^?\s]+)(?:\?.*)?$/;
const TWITTER_REG = /^(?:http(?:s)?:\/\/)?(?:(?:w){3}.)?twitter.com/;
const FIGMA_REG = /^https:\/\/www\.figma\.com/;
const EXCALIDRAW_REG = /^https:\/\/excalidraw.com/;

export const getEmbedLink = (
  link?: string | null,
): {
  link: string;
  aspectRatio: { w: number; h: number };
  type: "video" | "generic";
} | null => {
  if (!link) {
    return null;
  }

  let type: "video" | "generic" = "generic";
  let aspectRatio = { w: 560, h: 840 };
  const ytLink = link.match(YOUTUBE_REG);
  if (ytLink?.[1]) {
    const time = ytLink[2] ? `&t=${ytLink[2]}` : ``;
    const target = `${ytLink[1]}?enablejsapi=1${time}`;
    const isPortrait = link.includes("shorts");
    type = "video";
    link = `https://www.youtube.com/embed/${target}`;
    aspectRatio = isPortrait ? { w: 315, h: 560 } : { w: 560, h: 315 };
    return { link, aspectRatio, type };
  }

  const vimeoLink = link.match(VIMEO_REG);
  if (vimeoLink?.[1]) {
    const target = vimeoLink?.[1];
    type = "video";
    link = `https://player.vimeo.com/video/${target}?api=1`;
    aspectRatio = { w: 560, h: 315 };
    return { link, aspectRatio, type };
  }

  const twitterLink = link.match(TWITTER_REG);
  if (twitterLink) {
    type = "generic";
    link = `https://twitframe.com/show?url=${encodeURIComponent(link)}`;
    aspectRatio = { w: 550, h: 550 };
    return { link, aspectRatio, type };
  }

  const figmaLink = link.match(FIGMA_REG);
  if (figmaLink) {
    type = "generic";
    link = `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(
      link,
    )}`;
    aspectRatio = { w: 550, h: 550 };
    return { link, aspectRatio, type };
  }

  return { link, aspectRatio, type };
};

export const isURLOnWhiteList = (
  url: string,
  validators?: RegExp[],
): Boolean => {
  validators = validators ?? [];
  for (const validator of validators) {
    if (url.match(validator)) {
      return true;
    }
  }
  return Boolean(
    url.match(YOUTUBE_REG) ||
      url.match(VIMEO_REG) ||
      url.match(TWITTER_REG) ||
      url.match(FIGMA_REG) ||
      url.match(EXCALIDRAW_REG),
  );
};

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
  const text = element.link ?? "";
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
