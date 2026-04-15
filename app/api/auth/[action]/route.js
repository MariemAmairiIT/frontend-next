import { API_ENDPOINTS } from "@/constants";

export const runtime = "nodejs";

function parseRole(roleParam) {
  return roleParam === "admin" ? "ADMIN" : "STUDENT";
}

function parseAction(actionParam) {
  if (actionParam === "signup") return "SIGNUP";
  if (actionParam === "signin") return "SIGNIN";
  return null;
}

export async function POST(request, { params }) {
  const url = new URL(request.url);
  const role = parseRole(url.searchParams.get("role"));
  const action = parseAction(params?.action);

  if (!action) {
    return Response.json(
      { code: "INVALID_ACTION", message: "Invalid auth action" },
      { status: 400 },
    );
  }

  const roleEndpoint = API_ENDPOINTS.AUTH_BY_ROLE?.[role]?.[action];
  const genericEndpoint = API_ENDPOINTS.AUTH?.[action];
  const endpointCandidates = Array.from(
    new Set([roleEndpoint, genericEndpoint].filter(Boolean)),
  );

  if (endpointCandidates.length === 0) {
    return Response.json(
      { code: "MISSING_ENDPOINT", message: "Auth endpoint is not configured" },
      { status: 500 },
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { code: "INVALID_JSON", message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const headers = new Headers({
    "content-type": "application/json",
  });

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

  let upstream;
  let targetUrl = "";
  const attemptedUrls = [];

  for (let index = 0; index < endpointCandidates.length; index += 1) {
    const endpoint = endpointCandidates[index];
    targetUrl = `${API_ENDPOINTS.BASE_URL}${endpoint}`;
    attemptedUrls.push(targetUrl);

    try {
      upstream = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
    } catch (err) {
      return Response.json(
        {
          code: "UPSTREAM_UNREACHABLE",
          message: "Auth backend is unreachable",
          details: { cause: String(err?.message || err), targetUrl },
        },
        { status: 502 },
      );
    }

    const canTryFallback = index < endpointCandidates.length - 1;
    const shouldFallback =
      canTryFallback &&
      (upstream.status === 401 ||
        upstream.status === 404 ||
        upstream.status === 405);

    if (!shouldFallback) {
      break;
    }
  }

  const contentType = upstream.headers.get("content-type") || "";
  const isJson = contentType.toLowerCase().includes("json");

  if (isJson) {
    const data = await upstream.json().catch(() => null);

    if (upstream.status === 401) {
      return Response.json(
        {
          code: data?.code || "UNAUTHORIZED_UPSTREAM",
          message:
            data?.message ||
            "Unauthorized by backend auth endpoint. Check backend credentials and endpoint configuration.",
          details: {
            role,
            action,
            targetUrl,
            attemptedUrls,
            hasAuthorizationHeader: Boolean(authorization),
            hasApiKey: Boolean(apiKey),
          },
        },
        { status: 401 },
      );
    }

    return Response.json(data, { status: upstream.status });
  }

  const text = await upstream.text().catch(() => "");

  if (upstream.status === 401) {
    return Response.json(
      {
        code: "UNAUTHORIZED_UPSTREAM",
        message:
          text ||
          "Unauthorized by backend auth endpoint. Check backend credentials and endpoint configuration.",
        details: {
          role,
          action,
          targetUrl,
          attemptedUrls,
          hasAuthorizationHeader: Boolean(authorization),
          hasApiKey: Boolean(apiKey),
        },
      },
      { status: 401 },
    );
  }

  return new Response(text, {
    status: upstream.status,
    headers: {
      "content-type": contentType || "text/plain; charset=utf-8",
    },
  });
}
