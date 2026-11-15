import {
  createSession,
  formatUser,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  verifyCredentials,
} from "../../server/auth.js";
import {
  enforceRateLimit,
  getJsonBody,
  respondWithError,
  sendJson,
} from "../../server/http.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  try {
    if (!(await enforceRateLimit(request, "login", 10, 900))) {
      return sendJson(response, 429, { error: "Too many sign-in attempts. Try again later." });
    }

    const body = getJsonBody(request);
    const email = normalizeEmail(body.email);
    const password = body.password;
    if (!isValidEmail(email) || !isValidPassword(password)) {
      return sendJson(response, 400, { error: "The email or password is invalid." });
    }

    const user = await verifyCredentials(email, password);
    if (!user) {
      return sendJson(response, 401, { error: "The email or password is incorrect." });
    }
    if (body.role === "admin" && user.role !== "admin") {
      return sendJson(response, 403, { error: "This account is not an authorized reviewer." });
    }

    const session = await createSession(user);
    return sendJson(response, 200, { session, user: formatUser(user) });
  } catch (error) {
    return respondWithError(response, error);
  }
}
