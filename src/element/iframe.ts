import { register } from "../actions/register";
import { FONT_FAMILY, VERTICAL_ALIGN } from "../constants";
import { KEYS } from "../keys";
import { ExcalidrawProps } from "../types";
import { setCursorForShape, updateActiveTool } from "../utils";
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

export const hideActionForIFrame = (
  element: ExcalidrawElement | undefined,
  props: ExcalidrawProps,
) =>
  isIFrameElement(element) &&
  element.link &&
  element.link !== "" &&
  !props.iframeURLWhitelist;

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
    rawText: text,
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

export class IFrameURLValidator {
  private static instance: IFrameURLValidator;
  private validators: RegExp[];

  private constructor(validators: RegExp[] = []) {
    this.validators = validators;
  }

  public static getInstance(validators?: RegExp[]): IFrameURLValidator {
    if (!IFrameURLValidator.instance) {
      IFrameURLValidator.instance = new IFrameURLValidator(validators);
    }
    return IFrameURLValidator.instance;
  }

  public run(url: string | null | undefined): boolean {
    if (!url) {
      return false;
    }
    for (const validator of this.validators) {
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
  }
}
