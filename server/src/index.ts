import "dotenv/config";

import { buildApp } from "./app";
import { loadConfig } from "./config";
import { connectDatabase } from "./db";
import { purgeExpiredTrash } from "./repos/scenes";

const config = loadConfig();
const database = await connectDatabase(config.mongoUri, config.mongoDb);
const app = await buildApp(config, database);

// Hourly sweep of scenes that outlived the trash retention window.
const sweep = setInterval(() => {
  purgeExpiredTrash(database, app.storage, config.trashRetentionMs).catch(
    (err) => app.log.error({ err: err?.message }, "trash sweep failed"),
  );
}, 3_600_000);
sweep.unref();

const shutdown = async () => {
  await app.close();
  await database.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ port: config.port, host: config.host });
