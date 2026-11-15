import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const API_ROUTES = {
  "/api/config": "api/config.js",
  "/api/auth/signup": "api/auth/signup.js",
  "/api/auth/login": "api/auth/login.js",
  "/api/auth/admin-signup": "api/auth/admin-signup.js",
  "/api/auth/session": "api/auth/session.js",
  "/api/auth/logout": "api/auth/logout.js",
  "/api/orders": "api/orders/index.js",
  "/api/orders/receipt-upload": "api/orders/receipt-upload.js",
  "/api/admin/orders": "api/admin/orders.js",
  "/api/admin/review": "api/admin/review.js",
  "/api/admin/check-in": "api/admin/check-in.js",
  "/api/admin/receipt": "api/admin/receipt.js",
};

const MAX_API_BODY_SIZE = 4.5 * 1024 * 1024;

function localApiRoutes() {
  return {
    name: "decembizzy-local-api-routes",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const requestUrl = new URL(request.url || "/", "http://localhost");
        if (!requestUrl.pathname.startsWith("/api/")) {
          next();
          return;
        }

        let route = API_ROUTES[requestUrl.pathname];
        let orderNumber;
        if (!route) {
          const orderMatch = requestUrl.pathname.match(/^\/api\/orders\/([^/]+)$/);
          if (orderMatch) {
            route = "api/orders/[orderNumber].js";
            try {
              orderNumber = decodeURIComponent(orderMatch[1]);
            } catch {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: "The order number is invalid." }));
              return;
            }
          }
        }

        if (!route) {
          response.statusCode = 404;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.end(JSON.stringify({ error: "API route not found." }));
          return;
        }

        try {
          const query = Object.fromEntries(requestUrl.searchParams.entries());
          if (orderNumber) query.orderNumber = orderNumber;
          request.query = query;

          if (["POST", "PUT", "PATCH"].includes(request.method || "")) {
            const chunks = [];
            let size = 0;
            for await (const chunk of request) {
              size += chunk.length;
              if (size > MAX_API_BODY_SIZE) {
                response.statusCode = 413;
                response.setHeader("Content-Type", "application/json; charset=utf-8");
                response.end(JSON.stringify({ error: "Request body is too large." }));
                return;
              }
              chunks.push(chunk);
            }

            if (size > 0) {
              const contentType = request.headers["content-type"] || "";
              if (contentType.includes("application/json")) {
                try {
                  request.body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
                } catch {
                  response.statusCode = 400;
                  response.setHeader("Content-Type", "application/json; charset=utf-8");
                  response.end(JSON.stringify({ error: "Request body must be valid JSON." }));
                  return;
                }
              }
            }
          }

          response.status = (status) => {
            response.statusCode = status;
            return response;
          };
          response.json = (payload) => {
            if (response.writableEnded) return response;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(JSON.stringify(payload));
            return response;
          };

          const { default: handler } = await server.ssrLoadModule(
            resolve(server.config.root, route),
          );
          await handler(request, response);
        } catch (error) {
          console.error("Local Decembizzy API error:", error);
          if (response.headersSent || response.writableEnded) {
            response.destroy(error);
            return;
          }
          response.statusCode = 500;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.end(
            JSON.stringify({
              error: "The local API could not complete the request. Check the dev-server terminal for details.",
            }),
          );
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localApiRoutes()],
});
