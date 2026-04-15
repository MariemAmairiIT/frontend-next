export const runtime = "nodejs";

function joinUrlPath(basePathname, appendPath) {
  const base = typeof basePathname === "string" ? basePathname : "/";
  const append = typeof appendPath === "string" ? appendPath : "";

  const left = base.endsWith("/") ? base.slice(0, -1) : base;
  const right = append.startsWith("/") ? append : `/${append}`;

  const joined = `${left}${right}`;
  return joined === "" ? "/" : joined;
}

export async function POST(request) {
  const backendBaseUrl =
    process.env.PLANNING_BACKEND_URL ||
    process.env.BACKEND_URL ||
    "http://localhost:8081";
  const backendPath =
    process.env.PLANNING_REVISION_SUGGEST_PATH ||
    "/students/planning/revision-suggest";

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

  const upstreamHeaders = new Headers({
    "content-type": "application/json",
  });

  const authorization =
    request.headers.get("authorization") ||
    process.env.PLANNING_BACKEND_AUTHORIZATION;
  if (authorization) upstreamHeaders.set("authorization", authorization);

  const apiKey = process.env.PLANNING_BACKEND_API_KEY;
  if (apiKey) {
    const apiKeyHeader =
      process.env.PLANNING_BACKEND_API_KEY_HEADER || "x-api-key";
    upstreamHeaders.set(apiKeyHeader, apiKey);
  }

  const cookie = request.headers.get("cookie");
  if (cookie) upstreamHeaders.set("cookie", cookie);

  const targetUrl = new URL(backendBaseUrl);
  targetUrl.pathname = joinUrlPath(targetUrl.pathname, backendPath);

  let upstream;
  try {
    upstream = await fetch(targetUrl, {
      method: "POST",
      headers: upstreamHeaders,
      body: JSON.stringify(payload),
    });
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
    const upstreamPayload = await upstream.json().catch(() => null);
    return Response.json(upstreamPayload, { status: upstream.status });
  }

  const upstreamText = await upstream.text().catch(() => "");
  return new Response(upstreamText, {
    status: upstream.status,
    headers: {
      "content-type": contentType || "text/plain; charset=utf-8",
    },
  });
}
