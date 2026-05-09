import { proxyBackendJson } from "@/lib/api/serverProxy";

const BACKEND_EXAM_PERIOD_PATH = "/api/exam-period";

export async function POST(request) {
  try {
    const body = await request.json();
    return proxyBackendJson(request, BACKEND_EXAM_PERIOD_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export async function GET(request) {
  return proxyBackendJson(request, BACKEND_EXAM_PERIOD_PATH);
}
