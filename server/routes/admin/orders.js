import {
  createReceiptUrl,
  createReceiptDownloadUrl,
  requireAdmin,
  respondWithError,
  sendJson,
} from "../../http.js";
import { getOrdersCollection } from "../../mongodb.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  try {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const requestedStatus =
      typeof request.query?.status === "string" ? request.query.status : "pending_review";
    const allowedStatuses = new Set([
      "pending_review",
      "awaiting_transfer",
      "rejected",
      "approved",
      "all",
    ]);

    if (!allowedStatuses.has(requestedStatus)) {
      return sendJson(response, 400, { error: "Unknown order status." });
    }

    const ordersCollection = await getOrdersCollection();
    const filter = requestedStatus === "all" ? {} : { status: requestedStatus };
    const [orders, totalOrders, pendingReview, approvedOrders, ticketCounts, checkInCounts] =
      await Promise.all([
        ordersCollection.find(filter).sort({ createdAt: -1 }).limit(100).toArray(),
        ordersCollection.countDocuments(),
        ordersCollection.countDocuments({ status: "pending_review" }),
        ordersCollection.countDocuments({ status: "approved" }),
        ordersCollection
          .aggregate([{ $unwind: "$tickets" }, { $count: "count" }])
          .toArray(),
        ordersCollection
          .aggregate([{ $unwind: "$checkIns" }, { $count: "count" }])
          .toArray(),
      ]);

    const items = orders.map((order) => ({
      id: order._id.toString(),
      orderNumber: order.orderNumber,
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      quantity: order.quantity,
      amount: order.totalAmountKobo / 100,
      status: order.status,
      receiptUrl:
        order.receiptPath && /^[a-f\d]{24}$/i.test(order.receiptPath)
          ? createReceiptUrl(order.receiptPath, order._id.toString())
          : null,
      receiptDownloadUrl:
        order.receiptPath && /^[a-f\d]{24}$/i.test(order.receiptPath)
          ? createReceiptDownloadUrl(order.receiptPath, order._id.toString())
          : null,
      receiptUploadedAt: order.receiptUploadedAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      tickets: order.tickets.map((ticket) => ({
        code: ticket.code,
        status: ticket.status,
        checkedInAt: ticket.checkedInAt,
      })),
      reviews: order.reviews.map((review) => ({
        reviewerEmail: review.reviewerEmail,
        decision: review.decision,
        note: review.note,
        createdAt: review.createdAt,
      })),
    }));

    return sendJson(response, 200, {
      orders: items,
      summary: {
        totalOrders,
        pendingReview,
        approvedOrders,
        ticketsIssued: ticketCounts[0]?.count || 0,
        checkedIn: checkInCounts[0]?.count || 0,
      },
    });
  } catch (error) {
    return respondWithError(response, error);
  }
}
