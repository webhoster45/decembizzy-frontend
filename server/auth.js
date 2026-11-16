import { promisify } from "node:util";
import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { ObjectId } from "mongodb";
import {
  getSessionsCollection,
  getUsersCollection,
} from "./mongodb.js";

const scrypt = promisify(scryptCallback);
const PASSWORD_OPTIONS = {
  N: 32768,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};
const DUMMY_SALT = Buffer.from("decembizzy-login-salt");

export function getAuthSecret() {
  const secret = process.env.JWT_SECRET || process.env.JWT_SECERT;
  if (!secret) throw new Error("Authentication signing secret is not configured.");
  return secret;
}

export function getAdminSetupSecret() {
  return process.env.ADMIN_SECRET || process.env.ADMIN_SECERT || "";
}

export function matchesSecret(candidate, expected) {
  if (!candidate || !expected) return false;
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return (
    candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer)
  );
}

export function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function derivePasswordHash(password, salt) {
  const hash = await scrypt(password, salt, 64, PASSWORD_OPTIONS);
  return Buffer.from(hash);
}

export async function createAccount(email, password, role = "customer") {
  const salt = randomBytes(16);
  const passwordHash = await derivePasswordHash(password, salt);
  const user = {
    email,
    role,
    passwordSalt: salt.toString("hex"),
    passwordHash: passwordHash.toString("hex"),
    createdAt: new Date(),
  };
  const { insertedId } = await (await getUsersCollection()).insertOne(user);
  return { ...user, _id: insertedId };
}

export function formatUser(user) {
  return { id: user._id.toString(), email: user.email, role: user.role };
}

export async function verifyCredentials(email, password) {
  const user = await (await getUsersCollection()).findOne({ email });
  const salt = user
    ? Buffer.from(user.passwordSalt, "hex")
    : DUMMY_SALT;
  const actualHash = await derivePasswordHash(password, salt);
  const expectedHash = user
    ? Buffer.from(user.passwordHash, "hex")
    : Buffer.alloc(actualHash.length);
  const valid =
    actualHash.length === expectedHash.length &&
    timingSafeEqual(actualHash, expectedHash);

  return valid && user ? user : null;
}

function hashSessionToken(token) {
  return createHmac("sha256", getAuthSecret()).update(token).digest("hex");
}

export async function createSession(user) {
  const token = randomBytes(32).toString("base64url");
  await (await getSessionsCollection()).insertOne({
    _id: hashSessionToken(token),
    userId: user._id,
    createdAt: new Date(),
  });
  return {
    access_token: token,
    expires_at: null,
    user: formatUser(user),
  };
}

export async function getSessionUser(token) {
  if (!token) return null;
  const session = await (await getSessionsCollection()).findOne({
    _id: hashSessionToken(token),
  });
  if (!session) return null;
  const user = await (await getUsersCollection()).findOne({ _id: session.userId });
  return user ? formatUser(user) : null;
}

export async function deleteSession(token) {
  if (!token) return;
  await (await getSessionsCollection()).deleteOne({ _id: hashSessionToken(token) });
}

export function isValidPassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

export function isValidUserId(value) {
  return ObjectId.isValid(value);
}
