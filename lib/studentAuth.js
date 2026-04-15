const AUTH_KEY = "sp_auth_basic_v1";
const USER_KEY = "sp_user_v1";

export function toBasicAuth(email, password) {
  const raw = `${String(email || "")
    .trim()
    .toLowerCase()}:${String(password || "")}`;
  return `Basic ${btoa(raw)}`;
}

export function saveAuthSession({ email, password, user }) {
  if (typeof window === "undefined") return;
  const authHeader = toBasicAuth(email, password);
  sessionStorage.setItem(AUTH_KEY, authHeader);
  if (user) {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function getAuthHeader() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(AUTH_KEY);
}

export function getCurrentUser() {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(USER_KEY);
}
