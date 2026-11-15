import {
  enforceRateLimit,
  getJsonBody,
  requireAdmin,
  respondWithError,
  sendJson,
} from "../../server/http.js";
import { getOrdersCollection } from "../../server/mongodb.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  try {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const body = getJsonBody(request);
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!/^[A-F0-9]{32}$/.test(code)) {
      return sendJson(response, 400, { error: "Enter a valid ticket code." });
    }

    if (!(await enforceRateLimit(request, "ticket-check-in", 120, 600))) {
      return sendJson(response, 429, {
        error: "Too many check-in attempts. Please wait and try again.",
      });
    }

    const orders = await getOrdersCollection();
    const checkedInAt = new Date();
    const checkIn = await orders.updateOne(
      { tickets: { $elemMatch: { code, status: "valid" } } },
      {
        $set: {
          "tickets.$.status": "checked_in",
          "tickets.$.checkedInAt": checkedInAt,
          "tickets.$.checkedInBy": admin.email,
          updatedAt: checkedInAt,
        },
        $push: {
          checkIns: {
            ticketCode: code,
            reviewerUserId: admin.user.id,
            reviewerEmail: admin.email,
            checkedInAt,
          },
        },
      },
    );

    const order = await orders.findOne(
      { "tickets.code": code },
      {
        projection: {
          orderNumber: 1,
          buyerName: 1,
          tickets: { $elemMatch: { code } },
        },
      },
    );
    if (!order) return sendJson(response, 404, { error: "No ticket matches that code." });

    return sendJson(response, 200, {
      result: {
        status: checkIn.modifiedCount === 1 ? "checked_in" : order.tickets[0].status,
        order_number: order.orderNumber,
        buyer_name: order.buyerName,
      },
    });
  } catch (error) {
    return respondWithError(response, error);
  }
}
