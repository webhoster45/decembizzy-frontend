import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { GridFSBucket, MongoClient } from "mongodb";

const localEnvironmentFile = resolve(process.cwd(), ".env.origin");
if (existsSync(localEnvironmentFile)) process.loadEnvFile(localEnvironmentFile);

let client;
let databasePromise;

async function initializeDatabase() {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URL;
  if (!uri) throw new Error("MongoDB server environment is not configured.");

  client = new MongoClient(uri, {
    maxPoolSize: 5,
    minPoolSize: 0,
    maxIdleTimeMS: 30_000,
  });
  try {
    await client.connect();
    const databaseName =
      process.env.MONGODB_DB || client.options.dbName || "decembizzy";
    const database = client.db(databaseName);
    await Promise.all([
      database.collection("orders").createIndex(
        { orderNumber: 1 },
        { unique: true, name: "orders_order_number_unique" },
      ),
      database.collection("orders").createIndex(
        { buyerUserId: 1, createdAt: -1 },
        { name: "orders_buyer_created_at" },
      ),
      database.collection("orders").createIndex(
        { status: 1, createdAt: -1 },
        { name: "orders_status_created_at" },
      ),
      database.collection("orders").createIndex(
        { "tickets.code": 1 },
        { unique: true, sparse: true, name: "orders_ticket_code_unique" },
      ),
      database.collection("rateLimits").createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, name: "rate_limits_expiry" },
      ),
      database.collection("users").createIndex(
        { email: 1 },
        { unique: true, name: "users_email_unique" },
      ),
      database.collection("sessions").createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, name: "sessions_expiry" },
      ),
      database.collection("sessions").createIndex(
        { userId: 1 },
        { name: "sessions_user_id" },
      ),
    ]);
    return database;
  } catch (error) {
    await client.close().catch(() => undefined);
    client = undefined;
    throw error;
  }
}

export function getDatabase() {
  if (!databasePromise) {
    databasePromise = initializeDatabase().catch((error) => {
      databasePromise = undefined;
      throw error;
    });
  }
  return databasePromise;
}

export async function getOrdersCollection() {
  return (await getDatabase()).collection("orders");
}

export async function getUsersCollection() {
  return (await getDatabase()).collection("users");
}

export async function getSessionsCollection() {
  return (await getDatabase()).collection("sessions");
}

export async function getReceiptsBucket() {
  return new GridFSBucket(await getDatabase(), { bucketName: "receipts" });
}

export async function consumeRateLimit(rateKey, maxRequests, windowSeconds) {
  const database = await getDatabase();
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowSeconds * 1000);
  const expiresAt = new Date(now.getTime() + windowSeconds * 1000);
  const windowExpired = {
    $or: [
      { $eq: [{ $type: "$windowStartedAt" }, "missing"] },
      { $lte: ["$windowStartedAt", cutoff] },
    ],
  };

  const result = await database.collection("rateLimits").findOneAndUpdate(
    { _id: rateKey },
    [
      {
        $set: {
          windowStartedAt: {
            $cond: [windowExpired, now, "$windowStartedAt"],
          },
          requestCount: {
            $cond: [
              windowExpired,
              1,
              { $add: [{ $ifNull: ["$requestCount", 0] }, 1] },
            ],
          },
          expiresAt,
        },
      },
    ],
    { upsert: true, returnDocument: "after" },
  );

  return result.requestCount <= maxRequests;
}

export function formatOrder(order) {
  return {
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    buyerName: order.buyerName,
    quantity: order.quantity,
    amount: order.totalAmountKobo / 100,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    receiptUploadedAt: order.receiptUploadedAt || null,
    tickets: (order.tickets || []).map((ticket) => ({
      code: ticket.code,
      status: ticket.status,
      checkedInAt: ticket.checkedInAt || null,
    })),
  };
}

export async function getOrderByNumber(orderNumber) {
  return (await getOrdersCollection()).findOne({ orderNumber });
}
