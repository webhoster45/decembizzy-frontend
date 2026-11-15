import {
  enforceRateLimit,
  formatOrder,
  canAccessOrder,
  getOrderByNumber,
  respondWithError,
  sendJson,
} from "../../http.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  try {
    const orderNumber =
      typeof request.query?.orderNumber === "string"
        ? request.query.orderNumber.trim()
        : "";
    if (!orderNumber) {
      return sendJson(response, 400, { error: "The order number is required." });
    }

    if (!(await enforceRateLimit(request, "order-status", 60, 600))) {
      return sendJson(response, 429, {
        error: "Too many status checks. Please wait and try again.",
      });
    }

    const order = await getOrderByNumber(orderNumber);
    if (!order || !(await canAccessOrder(request, order))) {
      return sendJson(response, 404, { error: "The order was not found in this account." });
    }

    return sendJson(response, 200, { order: formatOrder(order) });
  } catch (error) {
    return respondWithError(response, error);
  }
}
