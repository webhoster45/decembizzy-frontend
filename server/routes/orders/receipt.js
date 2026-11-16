import { pipeline } from "node:stream/promises";
import { ObjectId } from "mongodb";
import {
  canAccessOrder,
  getOrderByNumber,
  requireCustomer,
  respondWithError,
  sendJson,
} from "../../http.js";
import { getDatabase, getReceiptsBucket } from "../../mongodb.js";

const RECEIPT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  try {
    const user = await requireCustomer(request, response);
    if (!user) return;

    const orderNumber = typeof request.query?.orderNumber === "string"
      ? request.query.orderNumber.trim()
      : "";
    const order = orderNumber ? await getOrderByNumber(orderNumber) : null;
    if (!order || !(await canAccessOrder(request, order))) {
      return sendJson(response, 404, { error: "The order could not be found in this account." });
    }
    if (!order.receiptPath) {
      return sendJson(response, 404, { error: "No receipt has been uploaded for this order yet." });
    }

    const fileId = new ObjectId(order.receiptPath);
    const file = await (await getDatabase()).collection("receipts.files").findOne({ _id: fileId });
    if (!file || file.metadata?.orderId !== order._id.toString() || file.metadata?.buyerUserId !== user.id) {
      return sendJson(response, 404, { error: "The receipt could not be found." });
    }

    const mimeType = RECEIPT_TYPES.has(file.metadata?.mimeType)
      ? file.metadata.mimeType
      : "application/octet-stream";
    const extension = mimeType === "application/pdf" ? "pdf" : mimeType.split("/")[1].replace("jpeg", "jpg");
    const download = request.query?.download === "1";
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    response.setHeader("Content-Type", mimeType);
    response.setHeader("Content-Length", file.length);
    response.setHeader("Content-Disposition", `${download ? "attachment" : "inline"}; filename="decembizzy-receipt.${extension}"`);
    await pipeline((await getReceiptsBucket()).openDownloadStream(fileId), response);
  } catch (error) {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }
    return respondWithError(response, error);
  }
}
