import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "./config.js";
import { createDatabaseConnection } from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema = await readFile(join(__dirname, "../schema.sql"), "utf8");

const rootConnection = await createDatabaseConnection();
await rootConnection.query(
  `CREATE DATABASE IF NOT EXISTS \`${config.mysql.database}\`
   DEFAULT CHARACTER SET utf8mb4
   COLLATE utf8mb4_unicode_ci`,
);
await rootConnection.end();

const appConnection = await createDatabaseConnection(config.mysql.database);
await appConnection.query(schema);
await appConnection.end();

console.log(`MySQL database initialized: ${config.mysql.database}`);
