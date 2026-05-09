import { proxyBackendJson } from "@/lib/api/serverProxy";

const BACKEND_LATEST_TIMETABLE_PATH = "/api/me/timetables/latest";

export async function GET(request) {
  return proxyBackendJson(request, BACKEND_LATEST_TIMETABLE_PATH);
}
