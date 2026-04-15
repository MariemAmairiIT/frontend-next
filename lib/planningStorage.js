const STORAGE_KEY = "studyplanner:planning";
const META_KEY = "studyplanner:planning-meta";
const EXTRACTION_KEY = "studyplanner:planning-extraction";
const REVISION_PREFS_KEY = "studyplanner:revision-prefs";
const USER_KEY = "sp_user_v1";

function getOwnerScope() {
  if (typeof window === "undefined") return "anon";

  try {
    const raw = window.sessionStorage.getItem(USER_KEY);
    if (!raw) return "anon";

    const parsed = JSON.parse(raw);
    const email = String(parsed?.email || "")
      .trim()
      .toLowerCase();
    if (!email) return "anon";

    return email.replace(/[^a-z0-9@._-]/g, "_");
  } catch {
    return "anon";
  }
}

function scopedKey(baseKey) {
  return `${baseKey}:${getOwnerScope()}`;
}

export const DAY_BACKEND_TO_UI = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",

  // French day names (sometimes returned by extraction/backends)
  LUNDI: "Monday",
  MARDI: "Tuesday",
  MERCREDI: "Wednesday",
  JEUDI: "Thursday",
  VENDREDI: "Friday",
  SAMEDI: "Saturday",
  DIMANCHE: "Sunday",
};

export const DAY_UI_TO_BACKEND = {
  Monday: "MONDAY",
  Tuesday: "TUESDAY",
  Wednesday: "WEDNESDAY",
  Thursday: "THURSDAY",
  Friday: "FRIDAY",
  Saturday: "SATURDAY",
  Sunday: "SUNDAY",
};

function normalizeDayKey(value) {
  const rawFull = String(value ?? "").trim();
  if (rawFull === "") return "";

  // Keep only the first word-ish token (handles things like "Lundi 12/04" or "Monday," etc.)
  const raw = rawFull.split(/[^A-Za-z\u00C0-\u024F]+/)[0] || rawFull;
  if (raw === "") return "";

  // Normalize accents (e.g. "Mercredi" stays same, but we keep this robust)
  try {
    return raw
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toUpperCase();
  } catch {
    return raw.toUpperCase();
  }
}

function backendDayToUiDay(day) {
  const key = normalizeDayKey(day);
  if (!key) return null;

  // Handle short forms too
  const alias = {
    MON: "MONDAY",
    TUE: "TUESDAY",
    WED: "WEDNESDAY",
    THU: "THURSDAY",
    FRI: "FRIDAY",
    SAT: "SATURDAY",
    SUN: "SUNDAY",
    LUN: "LUNDI",
    MAR: "MARDI",
    MER: "MERCREDI",
    JEU: "JEUDI",
    VEN: "VENDREDI",
    SAM: "SAMEDI",
    DIM: "DIMANCHE",
  };

  const normalized = alias[key] || key;
  return DAY_BACKEND_TO_UI[normalized] ?? null;
}

function uiDayFromUnknown(day) {
  // If the day is already in UI format ("Monday".."Sunday"), keep it.
  const raw = String(day ?? "").trim();
  if (!raw) return null;

  if (Object.prototype.hasOwnProperty.call(DAY_UI_TO_BACKEND, raw)) return raw;

  // Case-insensitive match for UI day names
  const key = normalizeDayKey(raw);
  const uiMatch = Object.keys(DAY_UI_TO_BACKEND).find(
    (ui) => normalizeDayKey(ui) === key,
  );
  if (uiMatch) return uiMatch;

  return backendDayToUiDay(raw);
}

function coerceMinutes(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const asNum = Number(value);
    if (Number.isFinite(asNum)) return asNum;
  }
  return null;
}

function normalizeTodos(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      id: String(item?.id || cryptoRandomId()),
      text: String(item?.text || "").trim(),
      done: Boolean(item?.done),
    }))
    .filter((item) => item.text.length > 0);
}

export const TYPE_TO_COLOR = {
  LECTURE: "bg-blue-100 border-blue-300 text-blue-900",
  LAB: "bg-green-100 border-green-300 text-green-900",
  TUTORIAL: "bg-purple-100 border-purple-300 text-purple-900",
  REVISION: "bg-purple-100 border-purple-300 text-purple-900",
  EXAM: "bg-red-100 border-red-300 text-red-900",
  OTHER: "bg-orange-100 border-orange-300 text-orange-900",
};

export const TYPE_LABEL_FR = {
  LECTURE: "Cours",
  LAB: "TP",
  TUTORIAL: "Tutoriel",
  REVISION: "Révision",
  EXAM: "Examen",
  OTHER: "Autre",
};

function normalizeTypeKey(value) {
  const raw = String(value ?? "").trim();
  const upper = raw.toUpperCase();
  // If extraction didn't provide a type, treat it as a normal course by default.
  if (!upper) return "LECTURE";

  // Common aliases coming from OCR/extraction/backends
  const alias = {
    COURS: "LECTURE",
    COURSE: "LECTURE",
    CM: "LECTURE",
    LECTURE: "LECTURE",

    TP: "LAB",
    LAB: "LAB",

    TD: "TUTORIAL",
    TUTO: "TUTORIAL",
    TUTORIAL: "TUTORIAL",

    REVISION: "REVISION",
    RÉVISION: "REVISION",

    EXAMEN: "EXAM",
    EXAM: "EXAM",

    AUTRE: "OTHER",
    OTHER: "OTHER",
  };

  return alias[upper] || upper;
}

export function loadRevisionPrefs() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(scopedKey(REVISION_PREFS_KEY));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveRevisionPrefs(prefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      scopedKey(REVISION_PREFS_KEY),
      JSON.stringify(prefs),
    );
  } catch {
    // ignore quota/storage errors
  }
}

export function loadPlanningFromStorage() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(scopedKey(STORAGE_KEY));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.events)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePlanningToStorage(planning) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      scopedKey(STORAGE_KEY),
      JSON.stringify(planning),
    );
  } catch {
    // ignore quota/storage errors
  }
}

export function loadPlanningMeta() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(scopedKey(META_KEY));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePlanningMeta(meta) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(scopedKey(META_KEY), JSON.stringify(meta));
  } catch {
    // ignore quota/storage errors
  }
}

export function clearPlanningStorage() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(scopedKey(STORAGE_KEY));
    window.localStorage.removeItem(scopedKey(META_KEY));
  } catch {
    // ignore
  }
}

export function loadExtractionState() {
  if (typeof window === "undefined") return null;
  try {
    const key = scopedKey(EXTRACTION_KEY);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    // Prevent users from getting stuck if they navigated away mid-request.
    const startedAt =
      typeof parsed.startedAt === "number" ? parsed.startedAt : null;
    if (typeof startedAt === "number") {
      const ageMs = Date.now() - startedAt;
      if (Number.isFinite(ageMs) && ageMs > 10 * 60 * 1000) {
        window.localStorage.removeItem(key);
        return null;
      }
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveExtractionState(state) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      scopedKey(EXTRACTION_KEY),
      JSON.stringify(state),
    );
  } catch {
    // ignore
  }
}

export function clearExtractionState() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(scopedKey(EXTRACTION_KEY));
  } catch {
    // ignore
  }
}

export function timeToMinutes(time) {
  if (typeof time === "number" && Number.isFinite(time)) {
    // If backend accidentally sends minutes already, accept it.
    return time;
  }

  const raw = String(time ?? "").trim();
  if (raw === "") return null;

  // Common patterns: "8:30", "08:30", "8h30", "8.30", "8 30"
  const match = raw.match(/(\d{1,2})\s*[:h.\s]\s*(\d{1,2})/i);
  if (match) {
    const hour = parseInt(match[1], 10);
    const min = parseInt(match[2], 10);
    if (Number.isNaN(hour) || Number.isNaN(min)) return null;
    if (hour < 0 || hour > 23 || min < 0 || min > 59) return null;
    return hour * 60 + min;
  }

  // Compact formats: "830", "0830"
  if (/^\d{3,4}$/.test(raw)) {
    const digits = raw.padStart(4, "0");
    const hour = parseInt(digits.slice(0, 2), 10);
    const min = parseInt(digits.slice(2, 4), 10);
    if (Number.isNaN(hour) || Number.isNaN(min)) return null;
    if (hour < 0 || hour > 23 || min < 0 || min > 59) return null;
    return hour * 60 + min;
  }

  return null;
}

export function minutesToTime(minutes) {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, minutes));
  const hour = Math.floor(clamped / 60);
  const min = clamped % 60;
  return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function backendPlanningToUiEvents(planning) {
  const events = Array.isArray(planning?.events) ? planning.events : [];
  return events
    .map((ev) => {
      const uiDay = uiDayFromUnknown(ev?.day);

      // Support both shapes:
      // - backend extracted: { start: "08:30", end: "11:45" }
      // - UI format: { startMin: 510, endMin: 705 }
      const startMin = coerceMinutes(ev?.startMin) ?? timeToMinutes(ev?.start);
      const endMin = coerceMinutes(ev?.endMin) ?? timeToMinutes(ev?.end);

      const subjectRaw = String(ev?.subject || "").trim();
      const subjectLower = subjectRaw.toLowerCase();
      const isRevisionBySubject =
        subjectLower.startsWith("revision -") ||
        subjectLower.startsWith("révision -") ||
        subjectLower.startsWith("revision") ||
        subjectLower.startsWith("révision");

      const normalizedType = normalizeTypeKey(ev?.type);
      const type =
        normalizedType === "REVISION" || isRevisionBySubject
          ? "REVISION"
          : normalizedType;
      if (!uiDay || typeof startMin !== "number" || typeof endMin !== "number")
        return null;
      if (endMin <= startMin) return null;

      return {
        id: String(ev.id || cryptoRandomId()),
        day: uiDay,
        startMin,
        endMin,
        subject: subjectRaw,
        room: String(ev.room || ""),
        type,
        todos: normalizeTodos(ev?.todos),
        color:
          type === "REVISION"
            ? TYPE_TO_COLOR.REVISION
            : String(ev.color || "") ||
              (TYPE_TO_COLOR[type] ?? TYPE_TO_COLOR.LECTURE),
      };
    })
    .filter(Boolean);
}

export function uiEventsToBackendPlanning(
  uiEvents,
  timezone = "Europe/Paris",
  warnings = [],
) {
  const events = (Array.isArray(uiEvents) ? uiEvents : []).map((ev) => {
    const backendDay = DAY_UI_TO_BACKEND[ev.day] ?? "MONDAY";
    const start = minutesToTime(ev.startMin);
    const end = minutesToTime(ev.endMin);
    const durationMinutes = Math.max(0, ev.endMin - ev.startMin);
    const type = normalizeTypeKey(ev?.type);

    return {
      id: String(ev.id || cryptoRandomId()),
      day: backendDay,
      start,
      end,
      subject: String(ev.subject || ""),
      room: String(ev.room || ""),
      type,
      durationMinutes,
      todos: normalizeTodos(ev?.todos),
    };
  });

  return {
    timezone,
    hasWarnings: Array.isArray(warnings) && warnings.length > 0,
    warnings: Array.isArray(warnings) ? warnings : [],
    events,
  };
}

function cryptoRandomId() {
  try {
    // browsers
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
  } catch {
    // ignore
  }
  return `ev-${Math.random().toString(16).slice(2)}-${Date.now()}`;
}
