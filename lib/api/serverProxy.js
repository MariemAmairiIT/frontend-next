const BACKEND_URL =
  process.env.PLANNING_BACKEND_URL ||
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8081";

function joinUrlPath(basePathname, appendPath) {
  const base = typeof basePathname === "string" ? basePathname : "/";
  const append = typeof appendPath === "string" ? appendPath : "";
  const left = base.endsWith("/") ? base.slice(0, -1) : base;
  const right = append.startsWith("/") ? append : `/${append}`;
  const joined = `${left}${right}`;
  return joined === "" ? "/" : joined;
}

export async function proxyBackendJson(request, backendPath, options = {}) {
  const targetUrl = new URL(BACKEND_URL);
  targetUrl.pathname = joinUrlPath(targetUrl.pathname, backendPath);

  const query = options.query || "";
  if (query) targetUrl.search = query.startsWith("?") ? query : `?${query}`;

  const headers = new Headers(options.headers || {});

// 🚨 IMPORTANT: remove content-type if body is FormData
if (options.body instanceof FormData) {
  headers.delete("content-type");
}
  const authorization = request?.headers?.get("authorization");
  if (authorization && !headers.has("authorization")) {
    headers.set("authorization", authorization);
  }

  const cookie = request?.headers?.get("cookie");
  if (cookie && !headers.has("cookie")) {
    headers.set("cookie", cookie);
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: options.method || "GET",
      headers,
      body: options.body,
    });

    const contentType = upstream.headers.get("content-type") || "";
    if (contentType.toLowerCase().includes("json")) {
      const data = await upstream.json().catch(() => null);
      return Response.json(data, { status: upstream.status });
    }

    const text = await upstream.text().catch(() => "");
    return new Response(text, {
      status: upstream.status,
      headers: { "content-type": contentType || "text/plain; charset=utf-8" },
    });
  } catch (error) {
    return Response.json(
      {
        code: "UPSTREAM_UNREACHABLE",
        message: "Backend is unreachable",
        details: { cause: String(error?.message || error) },
      },
      { status: 502 },
    );
  }
}
