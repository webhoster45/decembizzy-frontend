import { pipeline } from "node:stream/promises";
import { ObjectId } from "mongodb";
import {
  isValidObjectId,
  respondWithError,
  sendJson,
  verifyReceiptUrl,
} from "../../server/http.js";
import { getDatabase, getReceiptsBucket } from "../../server/mongodb.js";

const CONTENT_TYPES = new Set([
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
    const fileId = typeof request.query?.fileId === "string" ? request.query.fileId : "";
    const orderId = typeof request.query?.orderId === "string" ? request.query.orderId : "";
    const expires = typeof request.query?.expires === "string" ? request.query.expires : "";
    const signature =
      typeof request.query?.signature === "string" ? request.query.signature : "";

    if (
      !isValidObjectId(fileId) ||
      !isValidObjectId(orderId) ||
      !verifyReceiptUrl(fileId, orderId, expires, signature)
    ) {
      return sendJson(response, 403, { error: "This receipt link is invalid or expired." });
    }

    const database = await getDatabase();
    const file = await database
      .collection("receipts.files")
      .findOne({ _id: new ObjectId(fileId) });
    const order = await database.collection("orders").findOne(
      { _id: new ObjectId(orderId), receiptPath: fileId },
      { projection: { _id: 1 } },
    );
    if (!file || !order || file.metadata?.orderId !== orderId) {
      return sendJson(response, 404, { error: "The receipt could not be found." });
    }

    const mimeType = CONTENT_TYPES.has(file.metadata?.mimeType)
      ? file.metadata.mimeType
      : "application/octet-stream";
    const ext = mimeType === "application/pdf" ? "pdf" : mimeType.split("/")[1].replace("jpeg", "jpg");
    const isDownload = request.query?.download === "1";
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    response.setHeader("Content-Type", mimeType);
    response.setHeader("Content-Length", file.length);
    response.setHeader(
      "Content-Disposition",
      isDownload
        ? `attachment; filename="receipt.${ext}"`
        : `inline; filename="receipt.${ext}"`,
    );    await pipeline(
      (await getReceiptsBucket()).openDownloadStream(new ObjectId(fileId)),
      response,
    );
  } catch (error) {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }
    return respondWithError(response, error);
  }
}
