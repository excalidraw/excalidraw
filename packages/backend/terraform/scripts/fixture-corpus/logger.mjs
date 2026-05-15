/**
 * Shared fixture-corpus logging: ISO timestamps, optional file mirror.
 *
 *   FIXTURES_LOG_FILE=path/to/run.log  (append)
 *   or pass createLogger({ logFile: "..." })
 */
import fs from "node:fs";
import path from "node:path";

function fmtLine(level, message) {
  return `[${new Date().toISOString()}] [${level}] ${message}`;
}

/**
 * @param {{ logFile?: string | null }} opts
 */
export function createLogger(opts = {}) {
  const logFile =
    opts.logFile ||
    (process.env.FIXTURES_LOG_FILE
      ? path.resolve(process.env.FIXTURES_LOG_FILE)
      : null);

  let stream = null;
  if (logFile) {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    stream = fs.createWriteStream(logFile, { flags: "a" });
    stream.write(
      `\n--- session start ${new Date().toISOString()} pid=${process.pid} ---\n`,
    );
  }

  function emit(level, message) {
    const line = fmtLine(level, message);
    console.log(line);
    if (stream) {
      stream.write(`${line}\n`);
    }
  }

  return {
    logFile,
    info: (msg) => emit("INFO", msg),
    warn: (msg) => emit("WARN", msg),
    error: (msg) => emit("ERROR", msg),
    /** Milliseconds since t0, human readable */
    elapsed: (t0) => {
      const ms = Date.now() - t0;
      return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
    },
    close: () => {
      if (stream) {
        stream.write(`--- session end ${new Date().toISOString()} ---\n`);
        stream.end();
        stream = null;
      }
    },
  };
}
