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

export async function GET(request, { params }) {
  const qcmId = params.qcmId;

  const baseUrl = new URL(API_ENDPOINTS.BASE_URL);
  const upstreamUrl = new URL(baseUrl);
  upstreamUrl.pathname = joinUrlPath(
    baseUrl.pathname,
    `/api/qcms/${qcmId}/results`,
  );

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
        message: "Le backend QCM est injoignable",
        details: { cause: String(err?.message || err) },
      },
      { status: 502 },
    );
  }

  return proxyResponse(upstream);
}
