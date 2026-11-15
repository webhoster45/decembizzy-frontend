import { randomUUID } from "node:crypto";
import { finished } from "node:stream/promises";
import { ObjectId } from "mongodb";
import {
  canAccessOrder,
  enforceRateLimit,
  getJsonBody,
  getOrderByNumber,
  requireCustomer,
  respondWithError,
  sendJson,
} from "../../http.js";
import { getOrdersCollection, getReceiptsBucket } from "../../mongodb.js";

export const config = {
  api: { bodyParser: { sizeLimit: "4.5mb" } },
};

const MAX_FILE_SIZE = 3 * 1024 * 1024;
const FILE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  let uploadedId;
  let bucket;
  try {
    bucket = await getReceiptsBucket();
    const user = await requireCustomer(request, response);
    if (!user) return;

    const body = getJsonBody(request);
    const orderNumber =
      typeof body.orderNumber === "string" ? body.orderNumber.trim() : "";
    const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
    const fileSize = Number(body.fileSize);
    const fileData = typeof body.fileData === "string" ? body.fileData : "";

    if (!orderNumber) {
      return sendJson(response, 400, { error: "The order number is required." });
    }
    if (!Object.hasOwn(FILE_TYPES, mimeType)) {
      return sendJson(response, 400, {
        error: "Upload a JPG, PNG, WebP image, or PDF receipt.",
      });
    }
    if (
      !Number.isInteger(fileSize) ||
      fileSize <= 0 ||
      fileSize > MAX_FILE_SIZE ||
      fileData.length > Math.ceil((MAX_FILE_SIZE * 4) / 3) + 4
    ) {
      return sendJson(response, 400, {
        error: "Receipt files must be no larger than 3 MB.",
      });
    }
    if (!(await enforceRateLimit(request, "receipt-upload", 20, 600))) {
      return sendJson(response, 429, {
        error: "Too many upload attempts. Please wait and try again.",
      });
    }

    const order = await getOrderByNumber(orderNumber);
    if (!order || !(await canAccessOrder(request, order))) {
      return sendJson(response, 404, { error: "The order could not be found in this account." });
    }
    if (!["awaiting_transfer", "rejected"].includes(order.status)) {
      return sendJson(response, 409, {
        error: "A receipt can only be uploaded for an unpaid or rejected order.",
      });
    }
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(fileData)) {
      return sendJson(response, 400, { error: "The receipt file data is invalid." });
    }

    const fileBuffer = Buffer.from(fileData, "base64");
    if (
      fileBuffer.length !== fileSize ||
      fileBuffer.toString("base64") !== fileData
    ) {
      return sendJson(response, 400, { error: "The receipt file data is invalid." });
    }

    const receiptId = new ObjectId();
    const filename = `${randomUUID()}.${FILE_TYPES[mimeType]}`;
    const uploadStream = bucket.openUploadStream(filename, {
      id: receiptId,
      metadata: {
        orderId: order._id.toString(),
        buyerUserId: user.id,
        mimeType,
      },
    });
    uploadedId = receiptId;
    uploadStream.end(fileBuffer);
    await finished(uploadStream);

    const updatedAt = new Date();
    const updateResult = await (await getOrdersCollection()).updateOne(
      { _id: order._id, status: { $in: ["awaiting_transfer", "rejected"] } },
      {
        $set: {
          receiptPath: receiptId.toString(),
          receiptMimeType: mimeType,
          receiptUploadedAt: updatedAt,
          status: "pending_review",
          updatedAt,
        },
      },
    );

    if (updateResult.modifiedCount !== 1) {
      await bucket.delete(receiptId);
      uploadedId = undefined;
      return sendJson(response, 409, {
        error: "The order changed while you were submitting. Refresh its status and try again.",
      });
    }

    uploadedId = undefined;
    return sendJson(response, 200, {
      order: {
        orderNumber: order.orderNumber,
        status: "pending_review",
        amount: order.totalAmountKobo / 100,
        quantity: order.quantity,
        receiptUploadedAt: updatedAt,
        updatedAt,
      },
    });
  } catch (error) {
    if (uploadedId && bucket) {
      try {
        await bucket.delete(uploadedId);
      } catch (cleanupError) {
        console.error("Could not remove incomplete receipt:", cleanupError?.message || "Unknown error");
      }
    }
    return respondWithError(response, error);
  }
}
