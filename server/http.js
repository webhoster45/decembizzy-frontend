import { createHmac, timingSafeEqual } from "node:crypto";
import { getAuthSecret, getSessionUser } from "./auth.js";
import { consumeRateLimit, getOrderByNumber } from "./mongodb.js";

export { formatOrder, getOrderByNumber } from "./mongodb.js";

export function sendJson(response, status, payload) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  return response.status(status).json(payload);
}

export function requireMethod(request, response, allowedMethod) {
  if (request.method === allowedMethod) return true;

  response.setHeader("Allow", allowedMethod);
  sendJson(response, 405, { error: "Method not allowed." });
  return false;
}

export function getJsonBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body !== "string") return {};

  try {
    const body = JSON.parse(request.body);
    return body && typeof body === "object" && !Array.isArray(body) ? body : {};
  } catch {
    return {};
  }
}

function getBearerToken(request) {
  const authorization = request.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

export async function getAuthenticatedUser(request) {
  const token = getBearerToken(request);
  return getSessionUser(token);
}

export async function requireCustomer(request, response) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    sendJson(response, 401, { error: "Sign in with your email to continue." });
    return null;
  }
  return user;
}

export async function canAccessOrder(request, order) {
  const user = await getAuthenticatedUser(request);
  return Boolean(user && order.buyerUserId === user.id);
}

export async function enforceRateLimit(request, scope, limit, windowSeconds) {
  const secret = process.env.RATE_LIMIT_SECRET || getAuthSecret();

  const forwarded = request.headers["x-forwarded-for"];
  const ip =
    (typeof forwarded === "string" ? forwarded.split(",")[0] : "") ||
    request.headers["x-real-ip"] ||
    "unknown";
  const rateKey = createHmac("sha256", secret)
    .update(`${scope}:${ip}`)
    .digest("hex");
  return consumeRateLimit(rateKey, limit, windowSeconds);
}

export async function requireAdmin(request, response) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    sendJson(response, 401, { error: "Admin sign-in is required." });
    return null;
  }

  if (user.role !== "admin") {
    sendJson(response, 403, { error: "This account is not an authorized reviewer." });
    return null;
  }

  return { user, email: user.email };
}

export function isValidObjectId(value) {
  return typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
}

export function createReceiptUrl(receiptId, orderId) {
  const expires = Math.floor(Date.now() / 1000) + 300;
  const signature = createHmac("sha256", getAuthSecret())
    .update(`${receiptId}:${orderId}:${expires}`)
    .digest("hex");
  return `/api/admin/receipt?fileId=${encodeURIComponent(receiptId)}&orderId=${encodeURIComponent(orderId)}&expires=${expires}&signature=${signature}`;
}

export function createReceiptDownloadUrl(receiptId, orderId) {
  const expires = Math.floor(Date.now() / 1000) + 300;
  const signature = createHmac("sha256", getAuthSecret())
    .update(`${receiptId}:${orderId}:${expires}`)
    .digest("hex");
  return `/api/admin/receipt?fileId=${encodeURIComponent(receiptId)}&orderId=${encodeURIComponent(orderId)}&expires=${expires}&signature=${signature}&download=1`;
}

export function verifyReceiptUrl(fileId, orderId, expires, signature) {
  const expiry = Number(expires);
  if (
    !isValidObjectId(fileId) ||
    !isValidObjectId(orderId) ||
    !Number.isInteger(expiry) ||
    expiry < Math.floor(Date.now() / 1000) ||
    expiry > Math.floor(Date.now() / 1000) + 300 ||
    typeof signature !== "string" ||
    !/^[a-f\d]{64}$/i.test(signature)
  ) {
    return false;
  }
  const expected = createHmac("sha256", getAuthSecret())
    .update(`${fileId}:${orderId}:${expiry}`)
    .digest();
  const actual = Buffer.from(signature, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function respondWithError(response, error) {
  console.error("Decembizzy API error:", error?.message || "Unknown error");
  let message = "The request could not be completed. Please try again.";
  if (
    error?.message === "MongoDB server environment is not configured." ||
    error?.message === "Authentication signing secret is not configured." ||
    error?.message === "Rate-limit signing key is not configured."
  ) {
    message = "The server is missing required configuration. Check the Vercel environment variables.";
  } else if (error?.name === "MongoParseError") {
    message = "The server's MongoDB URL is invalid. Check the MONGODB_URL environment variable.";
  } else if (error?.name === "MongoServerSelectionError") {
    message = "The database is unreachable. Check the MongoDB URL and Atlas network access settings.";
  } else if (error?.name === "MongoNetworkError" || error?.code === "ECONNRESET") {
    message = "The database connection was interrupted. Check that MongoDB Atlas is online and allows connections from this network, then try again.";
  } else if (error?.code === 13 || error?.codeName === "Unauthorized") {
    message = "The database rejected the configured credentials. Check the MongoDB database user permissions.";
  }
  const status = error?.name === "MongoServerSelectionError" || error?.name === "MongoNetworkError" || error?.code === "ECONNRESET" ? 503 : 500;
  return sendJson(response, status, {
    error: message,
  });
}
