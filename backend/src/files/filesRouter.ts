import { Router } from "express";

import { asyncHandler, isBase64 } from "../http.js";
import { loadFile, saveFile } from "./filesRepository.js";

export const filesRouter = Router();

const isValidId = (id: string) => /^[A-Za-z0-9_-]+$/.test(id);

filesRouter.use("/:roomId", (req, res, next) => {
  if (!isValidId(req.params.roomId)) {
    res.status(400).json({ error: "invalid room id" });
    return;
  }
  next();
});

filesRouter.post(
  "/:roomId",
  asyncHandler(async (req, res) => {
    const { files } = req.body as {
      files?: { fileId?: unknown; data?: unknown }[];
    };

    if (
      !Array.isArray(files) ||
      files.some(
        (file) =>
          !file ||
          typeof file.fileId !== "string" ||
          !isValidId(file.fileId) ||
          !isBase64(file.data),
      )
    ) {
      res.status(400).json({
        error: "files must be an array of base64-encoded fileId/data objects",
      });
      return;
    }

    const results = await Promise.all(
      files.map(async ({ fileId, data }) => {
        try {
          await saveFile(
            req.params.roomId,
            fileId as string,
            Buffer.from(data as string, "base64"),
          );
          return { id: fileId as string, saved: true };
        } catch (error) {
          console.error(`Failed to save file ${fileId as string}`, error);
          return { id: fileId as string, saved: false };
        }
      }),
    );

    res.json({
      savedFiles: results.filter(({ saved }) => saved).map(({ id }) => id),
      erroredFiles: results.filter(({ saved }) => !saved).map(({ id }) => id),
    });
  }),
);

filesRouter.get(
  "/:roomId",
  asyncHandler(async (req, res) => {
    const ids = String(req.query.ids ?? "")
      .split(",")
      .filter(Boolean);

    if (ids.some((id) => !isValidId(id))) {
      res.status(400).json({ error: "invalid file id" });
      return;
    }

    const results = await Promise.all(
      ids.map(async (fileId) => {
        try {
          const data = await loadFile(req.params.roomId, fileId);
          return { fileId, data };
        } catch (error) {
          console.error(`Failed to load file ${fileId}`, error);
          return { fileId, data: null };
        }
      }),
    );

    res.json({
      loadedFiles: results
        .filter((result): result is { fileId: string; data: Buffer } =>
          Buffer.isBuffer(result.data),
        )
        .map(({ fileId, data }) => ({
          fileId,
          data: data.toString("base64"),
        })),
      erroredFiles: results
        .filter(({ data }) => !data)
        .map(({ fileId }) => fileId),
    });
  }),
);
