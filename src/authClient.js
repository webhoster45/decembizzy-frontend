const SESSION_KEY = "decembizzy-session";

export function getAuthToken() {
  try {
    return window.localStorage.getItem(SESSION_KEY) || "";
  } catch {
    return "";
  }
}

export function saveAuthToken(token) {
  window.localStorage.setItem(SESSION_KEY, token);
}

export function clearAuthToken() {
  window.localStorage.removeItem(SESSION_KEY);
}
