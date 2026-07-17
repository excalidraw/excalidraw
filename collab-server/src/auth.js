import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { config } from "./config.js";
import { pool } from "./db.js";

const SESSION_COOKIE_NAME = "shangban_session";
const OAUTH_STATE_COOKIE_NAME = "shangban_qq_state";

const parseCookies = (cookieHeader = "") => {
  const cookies = {};

  for (const cookie of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = cookie.trim().split("=");
    if (!rawName) {
      continue;
    }
    cookies[rawName] = decodeURIComponent(rawValue.join("="));
  }

  return cookies;
};

const hashToken = (token) => createHash("sha256").update(token).digest("hex");

const getCookieAttributes = ({ maxAge, httpOnly = true } = {}) => {
  const attributes = [
    "Path=/",
    `SameSite=${config.auth.cookieSameSite}`,
    `Max-Age=${maxAge ?? config.auth.sessionTtlSeconds}`,
  ];

  if (httpOnly) {
    attributes.push("HttpOnly");
  }

  if (config.auth.cookieSecure) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
};

export const getCorsHeaders = (methods = "GET, POST, OPTIONS") => ({
  "Access-Control-Allow-Origin": config.clientOrigin,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": methods,
  "Access-Control-Allow-Headers": "Content-Type",
});

export const setCookie = (res, name, value, options) => {
  const cookie = `${name}=${encodeURIComponent(value)}; ${getCookieAttributes(
    options,
  )}`;
  const existing = res.getHeader("Set-Cookie");

  if (existing) {
    res.setHeader(
      "Set-Cookie",
      Array.isArray(existing) ? [...existing, cookie] : [existing, cookie],
    );
    return;
  }

  res.setHeader("Set-Cookie", cookie);
};

export const clearCookie = (res, name) => {
  setCookie(res, name, "", { maxAge: 0 });
};

export const getRequestSessionToken = (req) =>
  parseCookies(req.headers.cookie)[SESSION_COOKIE_NAME] || null;

const createSession = async (userId) => {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + config.auth.sessionTtlSeconds * 1000);

  await pool.execute(
    `INSERT INTO auth_sessions (user_id, token_hash, expires_at)
     VALUES (:userId, :tokenHash, :expiresAt)`,
    { userId, tokenHash, expiresAt },
  );

  return token;
};

export const destroySession = async (token) => {
  if (!token) {
    return;
  }

  await pool.execute(
    `DELETE FROM auth_sessions WHERE token_hash = :tokenHash`,
    {
      tokenHash: hashToken(token),
    },
  );
};

export const getSessionUser = async (token) => {
  if (!token) {
    return null;
  }

  const [rows] = await pool.execute(
    `SELECT
       u.id,
       u.qq_openid AS qqOpenid,
       u.nickname,
       u.avatar_url AS avatarUrl
     FROM auth_sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = :tokenHash
       AND s.expires_at > CURRENT_TIMESTAMP
     LIMIT 1`,
    { tokenHash: hashToken(token) },
  );

  return rows[0] || null;
};

export const getRequestUser = async (req) =>
  getSessionUser(getRequestSessionToken(req));

const getAuthBaseUrl = (req) =>
  config.auth.publicBaseUrl || `http://${req.headers.host}`;

const getQqRedirectUri = (req) => `${getAuthBaseUrl(req)}/api/auth/qq/callback`;

export const handleAuthMe = async (req, res, json) => {
  const user = await getRequestUser(req);
  return json(res, 200, { user });
};

export const handleAuthLogout = async (req, res, json) => {
  await destroySession(getRequestSessionToken(req));
  clearCookie(res, SESSION_COOKIE_NAME);
  return json(res, 200, { ok: true });
};

export const handleQqLogin = (req, res) => {
  const returnTo = new URL(
    req.url || "/",
    getAuthBaseUrl(req),
  ).searchParams.get("returnTo");
  const safeReturnTo =
    returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : "/";
  const statePayload = `${randomBytes(16).toString("base64url")}.${Buffer.from(
    safeReturnTo,
  ).toString("base64url")}`;
  const authorizeUrl = new URL("https://graph.qq.com/oauth2.0/authorize");

  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", config.qq.appId);
  authorizeUrl.searchParams.set("redirect_uri", getQqRedirectUri(req));
  authorizeUrl.searchParams.set("state", statePayload);
  authorizeUrl.searchParams.set("scope", "get_user_info");

  setCookie(res, OAUTH_STATE_COOKIE_NAME, statePayload, {
    maxAge: 10 * 60,
  });
  res.writeHead(302, { Location: authorizeUrl.toString() });
  res.end();
};

const assertOauthState = (req, state) => {
  const expected = parseCookies(req.headers.cookie)[OAUTH_STATE_COOKIE_NAME];

  if (!expected || !state) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(state);

  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
};

const getReturnToFromState = (state) => {
  const encodedReturnTo = state.split(".")[1];
  if (!encodedReturnTo) {
    return "/";
  }

  const returnTo = Buffer.from(encodedReturnTo, "base64url").toString("utf8");
  return returnTo.startsWith("/") && !returnTo.startsWith("//")
    ? returnTo
    : "/";
};

const parseQqJsonp = (payload) => {
  const jsonMatch = payload.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Unexpected QQ response: ${payload}`);
  }
  return JSON.parse(jsonMatch[0]);
};

const fetchQqToken = async (req, code) => {
  const tokenUrl = new URL("https://graph.qq.com/oauth2.0/token");
  tokenUrl.searchParams.set("grant_type", "authorization_code");
  tokenUrl.searchParams.set("client_id", config.qq.appId);
  tokenUrl.searchParams.set("client_secret", config.qq.appKey);
  tokenUrl.searchParams.set("code", code);
  tokenUrl.searchParams.set("redirect_uri", getQqRedirectUri(req));
  tokenUrl.searchParams.set("fmt", "json");

  const response = await fetch(tokenUrl);
  const token = await response.json();

  if (!response.ok || !token.access_token) {
    throw new Error(`Failed to exchange QQ code: ${JSON.stringify(token)}`);
  }

  return token.access_token;
};

const fetchQqOpenid = async (accessToken) => {
  const meUrl = new URL("https://graph.qq.com/oauth2.0/me");
  meUrl.searchParams.set("access_token", accessToken);
  meUrl.searchParams.set("fmt", "json");

  const response = await fetch(meUrl);
  const text = await response.text();
  const data = text.trim().startsWith("{")
    ? JSON.parse(text)
    : parseQqJsonp(text);

  if (!response.ok || !data.openid) {
    throw new Error(`Failed to fetch QQ openid: ${text}`);
  }

  return data.openid;
};

const fetchQqProfile = async (accessToken, openid) => {
  const profileUrl = new URL("https://graph.qq.com/user/get_user_info");
  profileUrl.searchParams.set("access_token", accessToken);
  profileUrl.searchParams.set("oauth_consumer_key", config.qq.appId);
  profileUrl.searchParams.set("openid", openid);

  const response = await fetch(profileUrl);
  const profile = await response.json();

  if (!response.ok || profile.ret !== 0) {
    throw new Error(`Failed to fetch QQ profile: ${JSON.stringify(profile)}`);
  }

  return profile;
};

const upsertQqUser = async ({ openid, profile }) => {
  await pool.execute(
    `INSERT INTO users (qq_openid, nickname, avatar_url)
     VALUES (:openid, :nickname, :avatarUrl)
     ON DUPLICATE KEY UPDATE
       nickname = VALUES(nickname),
       avatar_url = VALUES(avatar_url),
       updated_at = CURRENT_TIMESTAMP`,
    {
      openid,
      nickname: profile.nickname || "QQ 用户",
      avatarUrl: profile.figureurl_qq_2 || profile.figureurl_qq_1 || null,
    },
  );

  const [rows] = await pool.execute(
    `SELECT id FROM users WHERE qq_openid = :openid LIMIT 1`,
    { openid },
  );

  return rows[0].id;
};

export const handleQqCallback = async (req, res, json) => {
  const url = new URL(req.url || "/", getAuthBaseUrl(req));
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !assertOauthState(req, state)) {
    return json(res, 400, { error: "invalid QQ login callback" });
  }

  try {
    const accessToken = await fetchQqToken(req, code);
    const openid = await fetchQqOpenid(accessToken);
    const profile = await fetchQqProfile(accessToken, openid);
    const userId = await upsertQqUser({ openid, profile });
    const sessionToken = await createSession(userId);

    setCookie(res, SESSION_COOKIE_NAME, sessionToken);
    clearCookie(res, OAUTH_STATE_COOKIE_NAME);
    res.writeHead(302, {
      Location: `${config.clientOrigin}${getReturnToFromState(state)}`,
    });
    res.end();
  } catch (error) {
    console.error("QQ login failed", error);
    return json(res, 500, { error: "QQ login failed" });
  }
};

export const isAuthenticatedSocket = async (socket) => {
  const token = parseCookies(socket.handshake.headers.cookie)[
    SESSION_COOKIE_NAME
  ];
  return !!(await getSessionUser(token));
};
