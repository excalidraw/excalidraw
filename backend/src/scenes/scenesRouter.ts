import { Router } from "express";

import { asyncHandler, isBase64 } from "../http.js";
import { getScene, saveScene } from "./scenesRepository.js";

export const scenesRouter = Router();

const isValidRoomId = (roomId: string) => /^[A-Za-z0-9_-]+$/.test(roomId);

scenesRouter.use("/:roomId", (req, res, next) => {
  if (!isValidRoomId(req.params.roomId)) {
    res.status(400).json({ error: "invalid room id" });
    return;
  }
  next();
});

scenesRouter.get(
  "/:roomId",
  asyncHandler(async (req, res) => {
    const scene = await getScene(req.params.roomId);
    if (!scene) {
      res.status(404).json({ error: "room not found" });
      return;
    }
    res.json({
      ciphertext: scene.ciphertext.toString("base64"),
      iv: scene.iv.toString("base64"),
      revision: scene.revision,
    });
  }),
);

scenesRouter.put(
  "/:roomId",
  asyncHandler(async (req, res) => {
    const { ciphertext, iv, expectedRevision } = req.body as {
      ciphertext?: unknown;
      iv?: unknown;
      expectedRevision?: unknown;
    };

    if (
      !isBase64(ciphertext) ||
      !isBase64(iv) ||
      !Number.isInteger(expectedRevision) ||
      (expectedRevision as number) < 0
    ) {
      res.status(400).json({
        error:
          "ciphertext and iv must be base64; expectedRevision must be a non-negative integer",
      });
      return;
    }

    const result = await saveScene(
      req.params.roomId,
      Buffer.from(ciphertext, "base64"),
      Buffer.from(iv, "base64"),
      expectedRevision as number,
    );

    if (!result.accepted) {
      res.status(409).json({
        error: "revision conflict",
        current: {
          ciphertext: result.current.ciphertext.toString("base64"),
          iv: result.current.iv.toString("base64"),
          revision: result.current.revision,
        },
      });
      return;
    }

    res.json({ revision: result.revision });
  }),
);
