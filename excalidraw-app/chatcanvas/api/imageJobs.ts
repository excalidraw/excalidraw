import { isDevEnv } from "@excalidraw/common";
import type { ImageJobResult } from "./mockImageJobs";
import {
  mockExtendImage,
  mockUpscaleImage,
  type ExtendRequest,
  type UpscaleRequest,
} from "./mockImageJobs";

const API_TIMEOUT_MS = 30_000;

const fetchWithTimeout = async (input: RequestInfo, init?: RequestInit) => {
  const controller = new AbortController();
  const id = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(id);
  }
};

export const extendImage = async (
  request: ExtendRequest,
): Promise<ImageJobResult & { source: "server" | "mock" }> => {
  if (isDevEnv()) {
    return mockExtendImage(request);
  }

  try {
    const response = await fetchWithTimeout("/api/image/extend", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileId: request.fileId,
        imageData: request.imageData,
        expand: request.expand,
        prompt: request.prompt,
        seed: request.seed,
        mode: request.mode ?? "outpaint",
      }),
    });

    if (!response.ok) {
      throw new Error("Image extend failed");
    }

    const result = (await response.json()) as {
      url?: string;
      blob?: string;
      width: number;
      height: number;
    };

    if (!result.url && !result.blob) {
      throw new Error("Invalid response from image extend");
    }

    const blob = result.url
      ? await (await fetch(result.url)).blob()
      : await (await fetch(result.blob as string)).blob();

    return {
      blob,
      width: result.width,
      height: result.height,
      source: "server",
    };
  } catch (error) {
    return mockExtendImage(request);
  }
};

export const upscaleImage = async (
  request: UpscaleRequest,
): Promise<ImageJobResult & { source: "server" | "mock" }> => {
  if (isDevEnv()) {
    return mockUpscaleImage(request);
  }

  try {
    const response = await fetchWithTimeout("/api/image/upscale", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileId: request.fileId,
        imageData: request.imageData,
        scale: request.scale,
      }),
    });

    if (!response.ok) {
      throw new Error("Image upscale failed");
    }

    const result = (await response.json()) as {
      url?: string;
      blob?: string;
      width: number;
      height: number;
    };

    if (!result.url && !result.blob) {
      throw new Error("Invalid response from image upscale");
    }

    const blob = result.url
      ? await (await fetch(result.url)).blob()
      : await (await fetch(result.blob as string)).blob();

    return {
      blob,
      width: result.width,
      height: result.height,
      source: "server",
    };
  } catch (error) {
    return mockUpscaleImage(request);
  }
};

export const splitLayers = async () => {
  throw new Error("Layer splitting is not implemented yet.");
};

export type { ExtendRequest, UpscaleRequest, ImageJobResult };
