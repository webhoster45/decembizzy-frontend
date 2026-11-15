import {
  createAccount,
  createSession,
  formatUser,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
} from "../../auth.js";
import {
  enforceRateLimit,
  getJsonBody,
  respondWithError,
  sendJson,
} from "../../http.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  try {
    if (!(await enforceRateLimit(request, "signup", 8, 3600))) {
      return sendJson(response, 429, { error: "Too many sign-up attempts. Try again later." });
    }

    const body = getJsonBody(request);
    const email = normalizeEmail(body.email);
    const password = body.password;
    if (!isValidEmail(email) || !isValidPassword(password)) {
      return sendJson(response, 400, {
        error: "Enter a valid email address and a password between 8 and 128 characters.",
      });
    }

    let user;
    try {
      user = await createAccount(email, password);
    } catch (error) {
      if (error?.code === 11000) {
        return sendJson(response, 409, {
          error: "An account already uses this email. Sign in instead.",
        });
      }
      throw error;
    }
    const session = await createSession(user);
    return sendJson(response, 201, { session, user: formatUser(user) });
  } catch (error) {
    return respondWithError(response, error);
  }
}
