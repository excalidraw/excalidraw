import mysql from "mysql2/promise";

import { config } from "./config.js";

export const createDatabaseConnection = (database) =>
  mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database,
    multipleStatements: true,
  });

export const pool = mysql.createPool({
  ...config.mysql,
  waitForConnections: true,
  namedPlaceholders: true,
});
