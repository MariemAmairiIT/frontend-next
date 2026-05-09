export const runtime = "nodejs";

function joinUrlPath(basePathname, appendPath) {
  const base = typeof basePathname === "string" ? basePathname : "/";
  const append = typeof appendPath === "string" ? appendPath : "";

  const left = base.endsWith("/") ? base.slice(0, -1) : base;
  const right = append.startsWith("/") ? append : `/${append}`;

  const joined = `${left}${right}`;
  return joined === "" ? "/" : joined;
}

function buildUpstreamHeaders(request, { withJsonContentType = false } = {}) {
  const headers = new Headers();
  if (withJsonContentType) {
    headers.set("content-type", "application/json");
  }

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

function buildTargetUrl() {
  const backendBaseUrl =
    process.env.PLANNING_BACKEND_URL ||
    process.env.BACKEND_URL ||
    "http://localhost:8081";
  const backendPath =
    process.env.PLANNING_REVISION_SESSIONS_PATH ||
    "/api/planning/revision-sessions";

  const targetUrl = new URL(backendBaseUrl);
  targetUrl.pathname = joinUrlPath(targetUrl.pathname, backendPath);
  return targetUrl;
}

async function proxyUpstream(upstreamPromise) {
  let upstream;
  try {
    upstream = await upstreamPromise;
  } catch (err) {
    return Response.json(
      {
        code: "UPSTREAM_UNREACHABLE",
        message: "Backend is unreachable",
        details: { cause: String(err?.message || err) },
      },
      { status: 502 },
    );
  }

  const contentType = upstream.headers.get("content-type") || "";
  const isJson = contentType.toLowerCase().includes("json");

  if (isJson) {
    const payload = await upstream.json().catch(() => null);
    return Response.json(payload, { status: upstream.status });
  }

  const payloadText = await upstream.text().catch(() => "");
  return new Response(payloadText, {
    status: upstream.status,
    headers: {
      "content-type": contentType || "text/plain; charset=utf-8",
    },
  });
}

export async function GET(request) {
  const targetUrl = buildTargetUrl();
  return proxyUpstream(
    fetch(targetUrl, {
      method: "GET",
      headers: buildUpstreamHeaders(request),
    }),
  );
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

  if (!payload || typeof payload !== "object") {
    return Response.json(
      { code: "INVALID_PAYLOAD", message: "Invalid payload" },
      { status: 400 },
    );
  }

  const targetUrl = buildTargetUrl();
  return proxyUpstream(
    fetch(targetUrl, {
      method: "POST",
      headers: buildUpstreamHeaders(request, { withJsonContentType: true }),
      body: JSON.stringify(payload),
    }),
  );
}
