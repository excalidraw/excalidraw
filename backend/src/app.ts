import express from "express";

import { filesRouter } from "./files/filesRouter.js";
import { scenesRouter } from "./scenes/scenesRouter.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "10mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/scenes", scenesRouter);
  app.use("/api/files", filesRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "not found" });
  });

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error(error);
      res.status(500).json({ error: "internal server error" });
    },
  );

  return app;
}
