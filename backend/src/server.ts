import { createServer } from "http";

import { createApp } from "./app.js";
import { prisma } from "./db.js";
import { env } from "./env.js";
import { attachCollabRelay } from "./realtime/collabRelay.js";

const httpServer = createServer(createApp());
const io = attachCollabRelay(httpServer);

httpServer.listen(env.port, () => {
  console.log(`backend listening on port ${env.port}`);
});

const shutdown = async (signal: string) => {
  console.log(`received ${signal}, shutting down`);
  io.close();
  await prisma.$disconnect();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
