import { proxyBackendJson } from "@/lib/api/serverProxy";

const BACKEND_PATH = "/api/exams/replace-all";

export async function POST(request) {
  try {
    const body = await request.json();
    return proxyBackendJson(request, BACKEND_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
