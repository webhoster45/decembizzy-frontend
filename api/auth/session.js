import {
  getAuthenticatedUser,
  respondWithError,
  sendJson,
} from "../../server/http.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return sendJson(response, 401, { error: "Your session has expired. Sign in again." });
    }
    return sendJson(response, 200, { user });
  } catch (error) {
    return respondWithError(response, error);
  }
}
