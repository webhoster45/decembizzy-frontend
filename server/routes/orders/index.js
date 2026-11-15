import { randomBytes } from "node:crypto";
import {
  enforceRateLimit,
  formatOrder,
  requireCustomer,
  respondWithError,
  sendJson,
} from "../../http.js";
import { getOrdersCollection } from "../../mongodb.js";
import { getPublicBankDetails } from "../../config.js";

const UNIT_AMOUNT_KOBO = 400000;

export default async function handler(request, response) {
  if (!["GET", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  try {
    const user = await requireCustomer(request, response);
    if (!user) return;

    if (request.method === "GET") {
      if (!(await enforceRateLimit(request, "customer-orders", 60, 600))) {
        return sendJson(response, 429, {
          error: "Too many order requests. Please wait a few minutes and try again.",
        });
      }

      const orders = await getOrdersCollection();
      const buyerOrders = await orders
        .find({ buyerUserId: user.id })
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      return sendJson(response, 200, { orders: buyerOrders.map(formatOrder) });
    }

    if (!getPublicBankDetails().configured) {
      return sendJson(response, 503, {
        error: "Ticket orders are not open yet. The organizers have not configured the official transfer account.",
      });
    }

    if (!(await enforceRateLimit(request, "create-order", 10, 600))) {
      return sendJson(response, 429, {
        error: "Too many order attempts. Please wait a few minutes and try again.",
      });
    }

    const body = request.body && typeof request.body === "object" ? request.body : {};
    const buyerName =
      typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
    const quantity = Number(body.quantity);

    if (buyerName.length < 2 || buyerName.length > 80) {
      return sendJson(response, 400, {
        error: "Enter a name between 2 and 80 characters.",
      });
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
      return sendJson(response, 400, {
        error: "You can order between 1 and 5 tickets.",
      });
    }

    const orderNumber = `DBZ-2026-${randomBytes(6).toString("hex").toUpperCase()}`;
    const now = new Date();
    const order = {
      orderNumber,
      buyerName,
      buyerEmail: user.email.toLowerCase(),
      buyerUserId: user.id,
      quantity,
      unitAmountKobo: UNIT_AMOUNT_KOBO,
      totalAmountKobo: quantity * UNIT_AMOUNT_KOBO,
      status: "awaiting_transfer",
      receiptPath: null,
      receiptUploadedAt: null,
      tickets: [],
      reviews: [],
      checkIns: [],
      createdAt: now,
      updatedAt: now,
    };
    const { insertedId } = await (await getOrdersCollection()).insertOne(order);

    return sendJson(response, 201, {
      order: {
        id: insertedId.toString(),
        orderNumber: order.orderNumber,
        quantity: order.quantity,
        amount: order.totalAmountKobo / 100,
        status: order.status,
        createdAt: order.createdAt,
      },
    });
  } catch (error) {
    return respondWithError(response, error);
  }
}
