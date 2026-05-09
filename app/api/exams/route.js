import { proxyBackendJson } from "@/lib/api/serverProxy";

/** Create a single exam (JSON) — must match Spring POST /api/exams */
const BACKEND_ADD_EXAM_PATH = "/api/exams";

export async function POST(request) {
  try {
    const body = await request.json();
    return proxyBackendJson(request, BACKEND_ADD_EXAM_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
