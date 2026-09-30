import { z } from "zod";

import { requireUser, sessionRateKey } from "../http";

import type { FastifyInstance } from "fastify";

const body = z.object({
  type: z.enum([
    "save_failure",
    "ws_failure",
    "export_failure",
    "ai_error",
    "client_error",
  ]),
  message: z.string().max(400),
  /** small structured hints (status codes, counts) — never scene content */
  context: z
    .record(z.union([z.string().max(80), z.number(), z.boolean()]))
    .optional(),
});

/**
 * Lets the browser report failures the server can't see (a save that never arrived, a socket
 * that dropped, a PDF that failed to render). Only the failure class and a short message are
 * kept: no drawing content, no tokens.
 */
export const telemetryRoutes = async (app: FastifyInstance) => {
  app.post(
    "/telemetry",
    {
      preHandler: app.requireAuth,
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
          keyGenerator: sessionRateKey,
        },
      },
    },
    async (req, reply) => {
      const user = requireUser(req);
      const b = body.parse(req.body);
      // Keys/URLs may leak into error strings; scrub obvious credentials before logging.
      const message = b.message
        .replace(/ewk_[A-Za-z0-9_-]{10}_[A-Za-z0-9_-]{20,}/g, "ewk_[redacted]")
        .replace(/(token|key|secret|password)=([^&\s]+)/gi, "$1=[redacted]")
        .replace(/\/share\/[A-Za-z0-9_-]{20,}/g, "/share/[redacted]");
      app.log.warn(
        {
          telemetry: { type: b.type, message, context: b.context ?? {} },
          userId: user._id.toHexString(),
        },
        "client-reported failure",
      );
      return reply.code(204).send();
    },
  );
};
