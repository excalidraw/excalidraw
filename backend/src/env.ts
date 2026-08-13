import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  get port() {
    const port = Number(process.env.PORT ?? 3010);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("PORT must be an integer between 1 and 65535");
    }
    return port;
  },
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get gcsBucket() {
    return required("GCS_BUCKET");
  },
};
