import { register } from "../actions/register";
import { FONT_FAMILY, VERTICAL_ALIGN } from "../constants";
import { t } from "../i18n";
import { ExcalidrawProps } from "../types";
import { getFontString, updateActiveTool } from "../utils";
import { setCursorForShape } from "../cursor";
import { newTextElement } from "./newElement";
import { getContainerElement, wrapText } from "./textElement";
import { isEmbeddableElement } from "./typeChecks";
import {
  ExcalidrawElement,
  ExcalidrawEmbeddableElement,
  NonDeletedExcalidrawElement,
  Theme,
} from "./types";

type EmbeddedLink =
  | ({
      aspectRatio: { w: number; h: number };
      warning?: string;
    } & (
      | { type: "video" | "generic"; link: string }
      | { type: "document"; srcdoc: (theme: Theme) => string }
    ))
  | null;

const embeddedLinkCache = new Map<string, EmbeddedLink>();

const RE_YOUTUBE =
  /^(?:http(?:s)?:\/\/)?(?:www\.)?youtu(?:be\.com|\.be)\/(embed\/|watch\?v=|shorts\/|playlist\?list=|embed\/videoseries\?list=)?([a-zA-Z0-9_-]+)(?:\?t=|&t=|\?start=|&start=)?([a-zA-Z0-9_-]+)?[^\s]*$/;

const RE_VIMEO =
  /^(?:http(?:s)?:\/\/)?(?:(?:w){3}.)?(?:player\.)?vimeo\.com\/(?:video\/)?([^?\s]+)(?:\?.*)?$/;
const RE_FIGMA = /^https:\/\/(?:www\.)?figma\.com/;

const RE_GH_GIST = /^https:\/\/gist\.github\.com/;
const RE_GH_GIST_EMBED =
  /^<script[\s\S]*?\ssrc=["'](https:\/\/gist.github.com\/.*?)\.js["']/i;

// not anchored to start to allow <blockquote> twitter embeds
const RE_TWITTER = /(?:http(?:s)?:\/\/)?(?:(?:w){3}.)?twitter.com/;
const RE_TWITTER_EMBED =
  /^<blockquote[\s\S]*?\shref=["'](https:\/\/twitter.com\/[^"']*)/i;

const RE_VALTOWN =
  /^https:\/\/(?:www\.)?val.town\/(v|embed)\/[a-zA-Z_$][0-9a-zA-Z_$]+\.[a-zA-Z_$][0-9a-zA-Z_$]+/;

const RE_GENERIC_EMBED =
  /^<(?:iframe|blockquote)[\s\S]*?\s(?:src|href)=["']([^"']*)["'][\s\S]*?>$/i;

const RE_GIPHY =
  /giphy.com\/(?:clips|embed|gifs)\/[a-zA-Z0-9]*?-?([a-zA-Z0-9]+)(?:[^a-zA-Z0-9]|$)/;

const ALLOWED_DOMAINS = new Set([
  "youtube.com",
  "youtu.be",
  "vimeo.com",
  "player.vimeo.com",
  "figma.com",
  "link.excalidraw.com",
  "gist.github.com",
  "twitter.com",
  "*.simplepdf.eu",
  "stackblitz.com",
  "val.town",
  "giphy.com",
  "dddice.com",
]);

const createSrcDoc = (body: string) => {
  return `<html><body>${body}</body></html>`;
};

export const getEmbedLink = (link: string | null | undefined): EmbeddedLink => {
  if (!link) {
    return null;
  }

  if (embeddedLinkCache.has(link)) {
    return embeddedLinkCache.get(link)!;
  }

  const originalLink = link;

  let type: "video" | "generic" = "generic";
  let aspectRatio = { w: 560, h: 840 };
  const ytLink = link.match(RE_YOUTUBE);
  if (ytLink?.[2]) {
    const time = ytLink[3] ? `&start=${ytLink[3]}` : ``;
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
    embeddedLinkCache.set(originalLink, { link, aspectRatio, type });
    return { link, aspectRatio, type };
  }

  const vimeoLink = link.match(RE_VIMEO);
  if (vimeoLink?.[1]) {
    const target = vimeoLink?.[1];
    const warning = !/^\d+$/.test(target)
      ? t("toast.unrecognizedLinkFormat")
      : undefined;
    type = "video";
    link = `https://player.vimeo.com/video/${target}?api=1`;
    aspectRatio = { w: 560, h: 315 };
    //warning deliberately ommited so it is displayed only once per link
    //same link next time will be served from cache
    embeddedLinkCache.set(originalLink, { link, aspectRatio, type });
    return { link, aspectRatio, type, warning };
  }

  const figmaLink = link.match(RE_FIGMA);
  if (figmaLink) {
    type = "generic";
    link = `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(
      link,
    )}`;
    aspectRatio = { w: 550, h: 550 };
    embeddedLinkCache.set(originalLink, { link, aspectRatio, type });
    return { link, aspectRatio, type };
  }

  const valLink = link.match(RE_VALTOWN);
  if (valLink) {
    link =
      valLink[1] === "embed" ? valLink[0] : valLink[0].replace("/v", "/embed");
    embeddedLinkCache.set(originalLink, { link, aspectRatio, type });
    return { link, aspectRatio, type };
  }

  if (RE_TWITTER.test(link)) {
    let ret: EmbeddedLink;
    // assume embed code
    if (/<blockquote/.test(link)) {
      const srcDoc = createSrcDoc(link);
      ret = {
        type: "document",
        srcdoc: () => srcDoc,
        aspectRatio: { w: 480, h: 480 },
      };
      // assume regular tweet url
    } else {
      ret = {
        type: "document",
        srcdoc: (theme: string) =>
          createSrcDoc(
            `<blockquote class="twitter-tweet" data-dnt="true" data-theme="${theme}"><a href="${link}"></a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>`,
          ),
        aspectRatio: { w: 480, h: 480 },
      };
    }
    embeddedLinkCache.set(originalLink, ret);
    return ret;
  }

  if (RE_GH_GIST.test(link)) {
    let ret: EmbeddedLink;
    // assume embed code
    if (/<script>/.test(link)) {
      const srcDoc = createSrcDoc(link);
      ret = {
        type: "document",
        srcdoc: () => srcDoc,
        aspectRatio: { w: 550, h: 720 },
      };
      // assume regular url
    } else {
      ret = {
        type: "document",
        srcdoc: () =>
          createSrcDoc(`
          <script src="${link}.js"></script>
          <style type="text/css">
            * { margin: 0px; }
            table, .gist { height: 100%; }
            .gist .gist-file { height: calc(100vh - 2px); padding: 0px; display: grid; grid-template-rows: 1fr auto; }
          </style>
        `),
        aspectRatio: { w: 550, h: 720 },
      };
    }
    embeddedLinkCache.set(link, ret);
    return ret;
  }

  embeddedLinkCache.set(link, { link, aspectRatio, type });
  return { link, aspectRatio, type };
};

export const isEmbeddableOrLabel = (
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
});

const validateHostname = (
  url: string,
  /** using a Set assumes it already contains normalized bare domains */
  allowedHostnames: Set<string> | string,
): boolean => {
  try {
    const { hostname } = new URL(url);

    const bareDomain = hostname.replace(/^www\./, "");
    const bareDomainWithFirstSubdomainWildcarded = bareDomain.replace(
      /^([^.]+)/,
      "*",
    );

    if (allowedHostnames instanceof Set) {
      return (
        ALLOWED_DOMAINS.has(bareDomain) ||
        ALLOWED_DOMAINS.has(bareDomainWithFirstSubdomainWildcarded)
      );
    }

    if (bareDomain === allowedHostnames.replace(/^www\./, "")) {
      return true;
    }
  } catch (error) {
    // ignore
  }
  return false;
};

export const extractSrc = (htmlString: string): string => {
  const twitterMatch = htmlString.match(RE_TWITTER_EMBED);
  if (twitterMatch && twitterMatch.length === 2) {
    return twitterMatch[1];
  }

  const gistMatch = htmlString.match(RE_GH_GIST_EMBED);
  if (gistMatch && gistMatch.length === 2) {
    return gistMatch[1];
  }

  if (RE_GIPHY.test(htmlString)) {
    return `https://giphy.com/embed/${RE_GIPHY.exec(htmlString)![1]}`;
  }

  const match = htmlString.match(RE_GENERIC_EMBED);
  if (match && match.length === 2) {
    return match[1];
  }
  return htmlString;
};

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
      for (const domain of validateEmbeddable) {
        if (domain instanceof RegExp) {
          if (url.match(domain)) {
            return true;
          }
        } else if (validateHostname(url, domain)) {
          return true;
        }
      }
      return false;
    }
  }

  return validateHostname(url, ALLOWED_DOMAINS);
};
