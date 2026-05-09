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
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:8081";
  const backendPath = "/api/exams/extract";

  const upstreamHeaders = new Headers();

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

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      {
        code: "INVALID_FORM_DATA",
        message: "Invalid multipart form-data",
      },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!file) {
    return Response.json(
      {
        code: "FILE_REQUIRED",
        message: "Missing file field",
      },
      { status: 400 },
    );
  }

  const forwardForm = new FormData();
  forwardForm.set("file", file);

  const targetUrl = new URL(backendBaseUrl);
  targetUrl.pathname = joinUrlPath(targetUrl.pathname, backendPath);

  let upstream;
  try {
    upstream = await fetch(targetUrl, {
      method: "POST",
      body: forwardForm,
      headers: upstreamHeaders,
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
