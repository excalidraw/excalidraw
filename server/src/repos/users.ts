import { MongoServerError, ObjectId } from "mongodb";

import type { Database, UserDoc } from "../db";

export class EmailTakenError extends Error {}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export const toPublicUser = (u: UserDoc): PublicUser => ({
  id: u._id.toHexString(),
  email: u.email,
  displayName: u.displayName,
  avatarUrl: u.avatarUrl,
  status: u.status,
  createdAt: u.createdAt.toISOString(),
  lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
});

export const createUser = async (
  database: Database,
  input: { email: string; passwordHash: string; displayName: string },
) => {
  const now = new Date();
  const doc: UserDoc = {
    _id: new ObjectId(),
    email: input.email.trim(),
    emailLower: input.email.trim().toLowerCase(),
    passwordHash: input.passwordHash,
    displayName: input.displayName,
    avatarUrl: null,
    status: "active",
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  };
  try {
    await database.c.users.insertOne(doc);
  } catch (e) {
    if (e instanceof MongoServerError && e.code === 11000) {
      throw new EmailTakenError();
    }
    throw e;
  }
  return doc;
};

export const findUserByEmail = (database: Database, email: string) =>
  database.c.users.findOne({ emailLower: email.trim().toLowerCase() });

export const findUserById = (database: Database, id: ObjectId) =>
  database.c.users.findOne({ _id: id });

export const updateUser = async (
  database: Database,
  id: ObjectId,
  patch: Partial<
    Pick<UserDoc, "displayName" | "avatarUrl" | "passwordHash" | "lastLoginAt">
  >,
) =>
  database.c.users.findOneAndUpdate(
    { _id: id },
    { $set: { ...patch, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
