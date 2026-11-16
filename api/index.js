import { sendJson } from "../server/http.js";
import config from "../server/routes/config.js";
import signup from "../server/routes/auth/signup.js";
import login from "../server/routes/auth/login.js";
import adminSignup from "../server/routes/auth/admin-signup.js";
import session from "../server/routes/auth/session.js";
import logout from "../server/routes/auth/logout.js";
import orders from "../server/routes/orders/index.js";
import receiptUpload from "../server/routes/orders/receipt-upload.js";
import orderReceipt from "../server/routes/orders/receipt.js";
import orderByNumber from "../server/routes/orders/[orderNumber].js";
import adminOrders from "../server/routes/admin/orders.js";
import review from "../server/routes/admin/review.js";
import checkIn from "../server/routes/admin/check-in.js";
import receipt from "../server/routes/admin/receipt.js";

const routes = {
  "/api/config": config,
  "/api/auth/signup": signup,
  "/api/auth/login": login,
  "/api/auth/admin-signup": adminSignup,
  "/api/auth/session": session,
  "/api/auth/logout": logout,
  "/api/orders": orders,
  "/api/orders/receipt-upload": receiptUpload,
  "/api/orders/receipt": orderReceipt,
  "/api/admin/orders": adminOrders,
  "/api/admin/review": review,
  "/api/admin/check-in": checkIn,
  "/api/admin/receipt": receipt,
};

export default async function handler(request, response) {
  const rewrittenPath = request.query?.path;
  const pathSegments = Array.isArray(rewrittenPath)
    ? rewrittenPath.join("/")
    : typeof rewrittenPath === "string"
      ? rewrittenPath
      : "";
  const requestPath = new URL(request.url || "/", "http://localhost").pathname;
  const pathname = pathSegments
    ? `/api/${pathSegments.replace(/^\/+|\/+$/g, "")}`
    : requestPath;
  let route = routes[pathname];
  if (!route) {
    const match = pathname.match(/^\/api\/orders\/([^/]+)$/);
    if (match) {
      try {
        request.query = { ...request.query, orderNumber: decodeURIComponent(match[1]) };
        route = orderByNumber;
      } catch {
        return sendJson(response, 400, { error: "The order number is invalid." });
      }
    }
  }
  if (!route) return sendJson(response, 404, { error: "API route not found." });
  return route(request, response);
}
