export const runtime = "nodejs";

import { API_ENDPOINTS } from "@/constants";

function joinUrlPath(basePathname, appendPath) {
  const base = typeof basePathname === "string" ? basePathname : "/";
  const append = typeof appendPath === "string" ? appendPath : "";

  const left = base.endsWith("/") ? base.slice(0, -1) : base;
  const right = append.startsWith("/") ? append : `/${append}`;
  const joined = `${left}${right}`;
  return joined === "" ? "/" : joined;
}

function buildUpstreamHeaders(request) {
  const headers = new Headers({ "content-type": "application/json" });

  const authorization =
    request.headers.get("authorization") ||
    process.env.PLANNING_BACKEND_AUTHORIZATION;
  if (authorization) headers.set("authorization", authorization);

  const apiKey = process.env.PLANNING_BACKEND_API_KEY;
  if (apiKey) {
    const apiKeyHeader =
      process.env.PLANNING_BACKEND_API_KEY_HEADER || "x-api-key";
    headers.set(apiKeyHeader, apiKey);
  }

  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);

  return headers;
}

function normalizeSubjects(payload) {
  if (!Array.isArray(payload)) return [];

  // Support either: ["math", "bio"] or [{id,name,qcmCount,...}]
  return payload
    .map((item) => {
      if (typeof item === "string") {
        const id = item;
        return { id, name: id, fileCount: 0, qcmCount: 0 };
      }

      if (!item || typeof item !== "object") return null;

      // Prefer slug for routing: /subjects/[subjectId]
      const id =
        (typeof item.slug === "string" && item.slug) ||
        (typeof item.id === "string" && item.id) ||
        (typeof item.subjectId === "string" && item.subjectId) ||
        (typeof item.subject === "string" && item.subject) ||
        (typeof item.name === "string" && item.name) ||
        "";

      if (!id) return null;

      return {
        id,
        name: typeof item.name === "string" && item.name ? item.name : id,
        fileCount: Number(item.fileCount || 0),
        qcmCount: Number(item.qcmCount || item.qcmsCount || 0),
      };
    })
    .filter(Boolean);
}

async function proxyResponse(upstream) {
  const contentType = upstream.headers.get("content-type") || "";
  const isJson = contentType.toLowerCase().includes("json");

  if (isJson) {
    const payload = await upstream.json().catch(() => null);
    return Response.json(payload, { status: upstream.status });
  }

  const text = await upstream.text().catch(() => "");
  return new Response(text, {
    status: upstream.status,
    headers: {
      "content-type": contentType || "text/plain; charset=utf-8",
    },
  });
}

export async function GET(request) {
  const baseUrl = new URL(API_ENDPOINTS.BASE_URL);
  const upstreamUrl = new URL(baseUrl);
  upstreamUrl.pathname = joinUrlPath(baseUrl.pathname, "/api/subjects");

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: buildUpstreamHeaders(request),
    });
  } catch (err) {
    return Response.json(
      {
        code: "UPSTREAM_UNREACHABLE",
        message: "Le backend est injoignable",
        details: { cause: String(err?.message || err) },
      },
      { status: 502 },
    );
  }

  const contentType = upstream.headers.get("content-type") || "";
  const isJson = contentType.toLowerCase().includes("json");

  if (!isJson) {
    return proxyResponse(upstream);
  }

  const payload = await upstream.json().catch(() => null);
  const normalized = normalizeSubjects(payload);
  return Response.json(normalized, { status: upstream.status });
}

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { code: "INVALID_JSON", message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const name = String(payload?.name || "").trim();
  if (!name) {
    return Response.json(
      { code: "MISSING_NAME", message: "name est requis" },
      { status: 400 },
    );
  }

  const baseUrl = new URL(API_ENDPOINTS.BASE_URL);
  const upstreamUrl = new URL(baseUrl);
  upstreamUrl.pathname = joinUrlPath(baseUrl.pathname, "/api/subjects");

  const createSubjectPayload = { name };

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: buildUpstreamHeaders(request),
      body: JSON.stringify(createSubjectPayload),
    });
  } catch (err) {
    return Response.json(
      {
        code: "UPSTREAM_UNREACHABLE",
        message: "Le backend est injoignable",
        details: { cause: String(err?.message || err) },
      },
      { status: 502 },
    );
  }

  return proxyResponse(upstream);
}
