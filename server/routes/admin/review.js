import { randomBytes } from "node:crypto";
import {
  getJsonBody,
  isValidObjectId,
  requireAdmin,
  respondWithError,
  sendJson,
} from "../../http.js";
import { ObjectId } from "mongodb";
import { getOrdersCollection } from "../../mongodb.js";
import { getPublicBankDetails } from "../../config.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  try {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const body = getJsonBody(request);
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    const decision = typeof body.decision === "string" ? body.decision : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
    const paymentVerified = body.paymentVerified === true;

    if (!isValidObjectId(orderId) || !["approved", "rejected"].includes(decision)) {
      return sendJson(response, 400, { error: "The review request is invalid." });
    }

    if (decision === "rejected" && note.length < 3) {
      return sendJson(response, 400, {
        error: "Add a short reason so the buyer knows what to correct.",
      });
    }

    if (decision === "approved" && !paymentVerified) {
      return sendJson(response, 400, {
        error: "Confirm that the transfer appears in the official bank statement before approving.",
      });
    }

    if (decision === "approved" && !getPublicBankDetails().configured) {
      return sendJson(response, 503, {
        error: "Payment approval is disabled until the organizers configure the official bank account.",
      });
    }

    const orders = await getOrdersCollection();
    const order = await orders.findOne({ _id: new ObjectId(orderId) });
    if (!order) return sendJson(response, 404, { error: "Order not found." });
    if (order.status !== "pending_review") {
      return sendJson(response, 409, {
        error: "This order is no longer awaiting review.",
      });
    }

    if (!order.receiptPath) {
      return sendJson(response, 409, {
        error: "This order has no uploaded receipt to review.",
      });
    }
    if (order.buyerEmail.toLowerCase() === admin.email) {
      return sendJson(response, 403, {
        error: "Reviewing an order from your own email is not allowed.",
      });
    }

    const now = new Date();
    const ticketCodes =
      decision === "approved"
        ? Array.from({ length: order.quantity }, () =>
            randomBytes(16).toString("hex").toUpperCase(),
          )
        : [];
    const review = {
      reviewerUserId: admin.user.id,
      reviewerEmail: admin.email,
      decision,
      note,
      createdAt: now,
    };
    const update = {
      $set: { status: decision, updatedAt: now },
      $push: { reviews: review },
    };
    if (decision === "approved") {
      update.$push.tickets = {
        $each: ticketCodes.map((code) => ({
          code,
          status: "valid",
          issuedAt: now,
          checkedInAt: null,
          checkedInBy: null,
        })),
      };
    }

    const result = await orders.updateOne(
      { _id: order._id, status: "pending_review", receiptPath: { $type: "string" } },
      update,
    );
    if (result.modifiedCount !== 1) {
      return sendJson(response, 409, {
        error: "This order was already reviewed by an administrator.",
      });
    }

    return sendJson(response, 200, {
      review: {
        order_id: order._id.toString(),
        order_number: order.orderNumber,
        status: decision,
        tickets_issued: ticketCodes.length,
      },
      tickets: ticketCodes,
    });
  } catch (error) {
    return respondWithError(response, error);
  }
}
