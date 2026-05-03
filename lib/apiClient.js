import { clearAuthSession, getAuthHeader } from "@/lib/studentAuth";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8081";

const isAbsoluteUrl = (value) => /^https?:\/\//i.test(String(value || ""));

const buildUrl = (path) => {
  const input = String(path || "");
  if (isAbsoluteUrl(input)) return input;
  if (input.startsWith("/api/")) return input;
  return `${BACKEND_URL}${input}`;
};

const parseBody = async (res) => {
  const text = await res.text().catch(() => "");
  if (!text) {
    return { text: "", data: null };
  }

  try {
    return { text, data: JSON.parse(text) };
  } catch {
    return { text, data: text };
  }
};

const createError = ({ res, data, text }) => {
  const detail =
    (data && data.message) ||
    (data && data.error) ||
    (typeof data === "string" ? data : null) ||
    `HTTP ${res.status}`;

  const err = new Error(detail);
  err.status = res.status;
  err.data = data;
  err.rawText = text;
  return err;
};

export async function apiFetch(path, options = {}) {
  const auth = getAuthHeader();
  const headers = new Headers(options.headers || {});
  if (auth && !headers.has("Authorization")) {
    headers.set("Authorization", auth);
  }

  const res = await fetch(buildUrl(path), {
    ...options,
    headers,
  });

  const { text, data } = await parseBody(res);

  if (res.status === 401) {
    clearAuthSession();
    if (typeof window !== "undefined") {
      window.location.href = "/signin?message=session-expirée";
    }
    throw createError({ res, data, text });
  }

  if (!res.ok) {
    throw createError({ res, data, text });
  }

  return data;
}
