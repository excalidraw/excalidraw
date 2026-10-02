import { z } from "zod";

const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? def : v === "true"));

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3100),
  HOST: z.string().default("127.0.0.1"),
  MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017"),
  MONGODB_DB: z.string().default("excalidraw_workspace"),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 chars"),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(14),
  COOKIE_SECURE: z.string().optional(),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_PREFIX: z.string().default(""),
  S3_FORCE_PATH_STYLE: z.string().optional(),
  STORAGE_PATH: z.string().default("./storage"),
  TRASH_RETENTION_DAYS: z.coerce.number().int().min(1).default(30),
  ENCRYPTION_KEY: z.string().min(32).optional(),
  AI_PROVIDER: z
    .enum(["openai", "anthropic", "gemini", "openrouter", "local"])
    .optional(),
  AI_MODEL: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_BASE_URL: z.string().url().optional(),
  AI_ALLOW_PRIVATE_BASE_URLS: z.string().optional(),
  AI_DEFAULT_WORKSPACE_LIMIT: z.coerce.number().int().min(0).default(200),
  AI_DEFAULT_USER_LIMIT: z.coerce.number().int().min(0).default(50),
  API_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(120),
  /** true | false | number of proxy hops (behind nginx use true or 1) */
  TRUST_PROXY: z.string().optional(),
  ALLOW_INSECURE_COOKIES: z.string().optional(),
  ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:3001,http://localhost:3002"),
  ENABLE_WORKSPACES: bool(true),
  ENABLE_COMMENTS: bool(true),
  ENABLE_PRESENTATIONS: bool(true),
  ENABLE_AI: bool(true),
  ENABLE_MCP: bool(false),
  ENABLE_PPTX_EXPORT: bool(true),
});

export type Config = {
  env: "development" | "test" | "production";
  port: number;
  host: string;
  mongoUri: string;
  mongoDb: string;
  sessionSecret: string;
  sessionTtlMs: number;
  cookieSecure: boolean;
  authRateLimitMax: number;
  storage: {
    provider: "local" | "s3";
    path: string;
    s3: {
      endpoint?: string;
      region: string;
      bucket?: string;
      accessKey?: string;
      secretKey?: string;
      prefix: string;
      forcePathStyle: boolean;
    };
  };
  trashRetentionMs: number;
  /** key for encrypting secrets at rest (AI keys); defaults to SESSION_SECRET */
  encryptionKey: string;
  ai: {
    provider?: "openai" | "anthropic" | "gemini" | "openrouter" | "local";
    model?: string;
    apiKey?: string;
    baseUrl?: string;
    allowPrivateBaseUrls: boolean;
    /** instance-wide defaults; 0 = unlimited */
    defaultWorkspaceLimit: number;
    defaultUserLimit: number;
  };
  /** requests per minute per API key */
  apiRateLimit: number;
  trustProxy: boolean | number;
  allowedOrigins: string[];
  flags: Record<
    "workspaces" | "comments" | "presentations" | "ai" | "mcp" | "pptxExport",
    boolean
  >;
};

const loadConfigUnchecked = (
  env: Record<string, string | undefined> = process.env,
): Config => {
  const e = schema.parse(env);
  return {
    env: e.NODE_ENV,
    port: e.PORT,
    host: e.HOST,
    mongoUri: e.MONGODB_URI,
    mongoDb: e.MONGODB_DB,
    sessionSecret: e.SESSION_SECRET,
    sessionTtlMs: e.SESSION_TTL_DAYS * 86_400_000,
    cookieSecure:
      e.COOKIE_SECURE !== undefined
        ? e.COOKIE_SECURE === "true"
        : e.NODE_ENV === "production",
    authRateLimitMax: e.AUTH_RATE_LIMIT_MAX,
    storage: {
      provider: e.STORAGE_PROVIDER,
      path: e.STORAGE_PATH,
      s3: {
        endpoint: e.S3_ENDPOINT,
        region: e.S3_REGION,
        bucket: e.S3_BUCKET,
        accessKey: e.S3_ACCESS_KEY,
        secretKey: e.S3_SECRET_KEY,
        prefix: e.S3_PREFIX.replace(/^\/+|\/+$/g, ""),
        // MinIO / R2 / Ceph need path-style URLs; AWS itself prefers virtual-hosted
        forcePathStyle:
          e.S3_FORCE_PATH_STYLE !== undefined
            ? e.S3_FORCE_PATH_STYLE === "true"
            : !!e.S3_ENDPOINT,
      },
    },
    trashRetentionMs: e.TRASH_RETENTION_DAYS * 86_400_000,
    encryptionKey: e.ENCRYPTION_KEY ?? e.SESSION_SECRET,
    ai: {
      provider: e.AI_PROVIDER,
      model: e.AI_MODEL,
      apiKey: e.AI_API_KEY,
      baseUrl: e.AI_BASE_URL,
      allowPrivateBaseUrls:
        e.AI_ALLOW_PRIVATE_BASE_URLS !== undefined
          ? e.AI_ALLOW_PRIVATE_BASE_URLS === "true"
          : e.NODE_ENV !== "production",
      defaultWorkspaceLimit: e.AI_DEFAULT_WORKSPACE_LIMIT,
      defaultUserLimit: e.AI_DEFAULT_USER_LIMIT,
    },
    apiRateLimit: e.API_RATE_LIMIT_PER_MINUTE,
    trustProxy:
      e.TRUST_PROXY === undefined ||
      e.TRUST_PROXY === "" ||
      e.TRUST_PROXY === "false"
        ? false
        : e.TRUST_PROXY === "true"
        ? true
        : Number.isInteger(Number(e.TRUST_PROXY))
        ? Number(e.TRUST_PROXY)
        : false,
    allowedOrigins: e.ALLOWED_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    flags: {
      workspaces: e.ENABLE_WORKSPACES,
      comments: e.ENABLE_COMMENTS,
      presentations: e.ENABLE_PRESENTATIONS,
      ai: e.ENABLE_AI,
      mcp: e.ENABLE_MCP,
      pptxExport: e.ENABLE_PPTX_EXPORT,
    },
  };
};

/** Refuses to boot a production instance with development-grade secrets or cookies. */
export const loadConfig = (
  env: Record<string, string | undefined> = process.env,
): Config => {
  const config = loadConfigUnchecked(env);
  if (config.env === "production") {
    const problems: string[] = [];
    if (/change-me|example|secret-secret/i.test(config.sessionSecret)) {
      problems.push(
        "SESSION_SECRET still looks like a placeholder (generate one with `openssl rand -base64 48`)",
      );
    }
    if (!config.cookieSecure && env.ALLOW_INSECURE_COOKIES !== "true") {
      problems.push(
        "COOKIE_SECURE=false in production (serve over HTTPS, or set ALLOW_INSECURE_COOKIES=true for a trusted LAN)",
      );
    }
    if (
      config.allowedOrigins.some((o) => /localhost|127\.0\.0\.1/.test(o)) &&
      config.allowedOrigins.length === 1
    ) {
      problems.push(
        "ALLOWED_ORIGINS only lists localhost; set it to your public https origin",
      );
    }
    if (problems.length) {
      throw new Error(
        `Refusing to start in production:\n - ${problems.join("\n - ")}`,
      );
    }
  }
  return config;
};
