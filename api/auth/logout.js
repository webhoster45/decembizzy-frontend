import { deleteSession } from "../../server/auth.js";
import { sendJson } from "../../server/http.js";

function getBearerToken(request) {
  const authorization = request.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  try {
    await deleteSession(getBearerToken(request));
    return sendJson(response, 200, { success: true });
  } catch (error) {
    console.error("Could not close Decembizzy session:", error?.message || "Unknown error");
    return sendJson(response, 500, { error: "Could not sign out. Please try again." });
  }
}
