import { proxyBackendJson } from "@/lib/api/serverProxy";

const BACKEND_SMART_PLANNING_PATH = "/api/planning/smart";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const timetableId = searchParams.get("timetableId");
    
    if (!timetableId) {
      return Response.json({ error: "timetableId is required" }, { status: 400 });
    }
    
    return proxyBackendJson(request, BACKEND_SMART_PLANNING_PATH, {
      query: `timetableId=${encodeURIComponent(timetableId)}`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
