import { z } from "zod";

import { SESSION_COOKIE } from "../constants";
import { writeAudit } from "../repos/audit";
import {
  createSession,
  deleteOtherSessions,
  deleteSessionByToken,
} from "../repos/sessions";
import {
  createUser,
  EmailTakenError,
  findUserByEmail,
  toPublicUser,
  updateUser,
} from "../repos/users";
import { createWorkspace } from "../repos/workspaces";
import {
  burnPasswordCheck,
  hashPassword,
  verifyPassword,
} from "../security/password";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ObjectId } from "mongodb";

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(10, "at least 10 characters").max(128);
const displayName = z.string().trim().min(1).max(80);
const avatarUrl = z
  .string()
  .url()
  .max(2048)
  .refine((u) => /^https?:\/\//i.test(u), "must be http(s)");

const registerBody = z.object({ email, password, displayName });
const loginBody = z.object({ email, password: z.string().min(1).max(128) });
const profileBody = z
  .object({
    displayName: displayName.optional(),
    avatarUrl: avatarUrl.nullable().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, "nothing to update");
const passwordBody = z.object({
  currentPassword: z.string().max(128),
  newPassword: password,
});

export const authRoutes = async (app: FastifyInstance) => {
  const { config, database } = app;

  const startSession = async (
    req: FastifyRequest,
    reply: FastifyReply,
    userId: ObjectId,
  ) => {
    const { token, expiresAt } = await createSession(database, {
      userId,
      secret: config.sessionSecret,
      ttlMs: config.sessionTtlMs,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.cookieSecure,
      path: "/",
      expires: expiresAt,
    });
  };

  const strict = {
    config: {
      rateLimit: { max: config.authRateLimitMax, timeWindow: "1 minute" },
    },
  };

  app.post("/auth/register", strict, async (req, reply) => {
    const body = registerBody.parse(req.body);
    let user;
    try {
      user = await createUser(database, {
        email: body.email,
        passwordHash: await hashPassword(body.password),
        displayName: body.displayName,
      });
    } catch (e) {
      if (e instanceof EmailTakenError) {
        return reply.code(409).send({ error: "email_taken" });
      }
      throw e;
    }
    // Every account starts with a personal workspace so the dashboard is usable.
    await createWorkspace(database, {
      name: `${body.displayName}'s workspace`.slice(0, 80),
      ownerId: user._id,
    });
    await startSession(req, reply, user._id);
    await writeAudit(database, {
      action: "USER_REGISTERED",
      actorId: user._id,
      ip: req.ip,
    });
    return reply.code(201).send({ user: toPublicUser(user) });
  });

  // Per-IP + per-email limiting to slow credential stuffing.
  app.post(
    "/auth/login",
    {
      config: {
        rateLimit: {
          max: config.authRateLimitMax,
          timeWindow: "1 minute",
          keyGenerator: (req: FastifyRequest) =>
            `${req.ip}:${String((req.body as any)?.email ?? "").toLowerCase()}`,
        },
      },
    },
    async (req, reply) => {
      const body = loginBody.parse(req.body);
      const user = await findUserByEmail(database, body.email);
      const ok = user
        ? await verifyPassword(body.password, user.passwordHash)
        : (await burnPasswordCheck(body.password), false);
      if (!user || !ok || user.status !== "active") {
        await writeAudit(database, {
          action: "USER_LOGIN_FAILED",
          actorId: user?._id ?? null,
          ip: req.ip,
        });
        return reply.code(401).send({ error: "invalid_credentials" });
      }
      const updated = await updateUser(database, user._id, {
        lastLoginAt: new Date(),
      });
      await startSession(req, reply, user._id);
      await writeAudit(database, {
        action: "USER_LOGIN",
        actorId: user._id,
        ip: req.ip,
      });
      return { user: toPublicUser(updated ?? user) };
    },
  );

  app.post("/auth/logout", async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) {
      await deleteSessionByToken(database, token, config.sessionSecret);
    }
    if (req.auth) {
      await writeAudit(database, {
        action: "USER_LOGOUT",
        actorId: req.auth.user._id,
        ip: req.ip,
      });
    }
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.code(204).send();
  });

  const guard = { preHandler: app.requireAuth };

  app.get("/auth/me", guard, async (req) => ({
    user: toPublicUser(req.auth!.user),
  }));

  app.patch("/me", guard, async (req) => {
    const patch = profileBody.parse(req.body);
    const updated = await updateUser(database, req.auth!.user._id, patch);
    await writeAudit(database, {
      action: "PROFILE_UPDATED",
      actorId: req.auth!.user._id,
      meta: { fields: Object.keys(patch) },
      ip: req.ip,
    });
    return { user: toPublicUser(updated!) };
  });

  app.post("/me/password", { ...guard, ...strict }, async (req, reply) => {
    const body = passwordBody.parse(req.body);
    const { user, session } = req.auth!;
    if (!(await verifyPassword(body.currentPassword, user.passwordHash))) {
      return reply.code(403).send({ error: "invalid_credentials" });
    }
    await updateUser(database, user._id, {
      passwordHash: await hashPassword(body.newPassword),
    });
    // Sign out every other device.
    await deleteOtherSessions(database, user._id, session._id);
    await writeAudit(database, {
      action: "PASSWORD_CHANGED",
      actorId: user._id,
      ip: req.ip,
    });
    return reply.code(204).send();
  });
};
