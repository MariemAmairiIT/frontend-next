"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import RevisionAvailabilityModal from "@/components/RevisionAvailabilityModal";
import RevisionCoefficientsModal from "@/components/RevisionCoefficientsModal";
import ModalShell from "@/components/ModalShell";
import {
  backendPlanningToUiEvents,
  DAY_UI_TO_BACKEND,
  loadPlanningFromStorage,
  loadPlanningMeta,
  savePlanningMeta,
  minutesToTime,
  timeToMinutes,
  saveRevisionPrefs,
  loadRevisionPrefs,
  savePlanningToStorage,
  TYPE_LABEL_FR,
  uiEventsToBackendPlanning,
} from "@/lib/planningStorage";
import { apiFetch } from "@/lib/apiClient";


const BASE_START_MIN = 8 * 60;
const BASE_END_MIN = 23 * 60;
const SNAP_MINUTES = 15;
const MIN_DURATION_MINUTES = 15;

const DEFAULT_WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];
const WEEKEND_DAYS = ["Saturday", "Sunday"];
const TIME_SLOTS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
  "23:00",
];

const REVISION_DAYS = [...DEFAULT_WEEK_DAYS, ...WEEKEND_DAYS];
const DEFAULT_BREAK_MINUTES = 10;
const AI_RATE_LIMIT_COOLDOWN_MS = 15 * 1000;
const AI_PAYLOAD_CACHE_TTL_MS = 90 * 1000;
const WEEKDAY_INDEX = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
};
const PLANNING_TYPE = {
  NORMAL: "NORMAL",
  EXAM: "EXAM",
};

const addDays = (date, deltaDays) => {
  const next = new Date(date);
  next.setDate(next.getDate() + deltaDays);
  return next;
};

const getMondayOfWeek = (inputDate) => {
  const date = new Date(inputDate);
  date.setHours(0, 0, 0, 0);
  const jsDay = date.getDay(); // Sunday=0 ... Saturday=6
  const distanceToMonday = (jsDay + 6) % 7;
  date.setDate(date.getDate() - distanceToMonday);
  return date;
};

const formatDateIso = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseIsoDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return null;
  }
  const parsed = new Date(`${value.trim()}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const formatShortFrDate = (date) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);

const defaultDaySlot = (day) => {
  const isWeekday = DEFAULT_WEEK_DAYS.includes(day);
  return {
    start: isWeekday ? "16:00" : "10:00",
    end: isWeekday ? "18:00" : "12:00",
  };
};

const normalizeDaySlots = (day, raw) => {
  const fallback = defaultDaySlot(day);

  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((slot) => ({
      start: String(slot?.start || fallback.start),
      end: String(slot?.end || fallback.end),
    }));
  }

  if (
    raw &&
    typeof raw === "object" &&
    Array.isArray(raw.slots) &&
    raw.slots.length > 0
  ) {
    return raw.slots.map((slot) => ({
      start: String(slot?.start || fallback.start),
      end: String(slot?.end || fallback.end),
    }));
  }

  if (raw && typeof raw === "object" && (raw.start || raw.end)) {
    return [
      {
        start: String(raw.start || fallback.start),
        end: String(raw.end || fallback.end),
      },
    ];
  }

  return [fallback];
};

const normalizeAvailabilityDay = (day, value) => {
  const slots = normalizeDaySlots(day, value);
  return {
    enabled: Boolean(value?.enabled),
    slots,
  };
};

const normalizeAvailabilityMap = (value) => {
  const normalized = {};
  for (const day of REVISION_DAYS) {
    normalized[day] = normalizeAvailabilityDay(day, value?.[day]);
  }
  return normalized;
};

const defaultRevisionAvailability = () => {
  return normalizeAvailabilityMap({});
};

const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));

const REVISION_COLOR_CLASS = "bg-purple-100 border-purple-300 text-purple-900";

const makeId = () => {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
  } catch {
    // ignore and fallback
  }
  return `rev-${Math.random().toString(16).slice(2)}-${Date.now()}`;
};

const normalizeRevisionTodos = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      id: String(item?.id || makeId()),
      text: String(item?.text || "").trim(),
      done: Boolean(item?.done),
    }))
    .filter((item) => item.text.length > 0);
};

const mergeIntervals = (intervals) => {
  const sorted = (Array.isArray(intervals) ? intervals : [])
    .filter(
      (it) =>
        Number.isFinite(it?.start) &&
        Number.isFinite(it?.end) &&
        it.end > it.start,
    )
    .sort((a, b) => a.start - b.start);

  const merged = [];
  for (const cur of sorted) {
    const last = merged[merged.length - 1];
    if (!last || cur.start > last.end) {
      merged.push({ start: cur.start, end: cur.end });
    } else {
      last.end = Math.max(last.end, cur.end);
    }
  }
  return merged;
};

const subtractIntervals = (baseInterval, blockedIntervals) => {
  let pieces = [{ start: baseInterval.start, end: baseInterval.end }];
  for (const block of blockedIntervals) {
    const next = [];
    for (const piece of pieces) {
      if (block.end <= piece.start || block.start >= piece.end) {
        next.push(piece);
        continue;
      }
      if (block.start > piece.start) {
        next.push({ start: piece.start, end: block.start });
      }
      if (block.end < piece.end) {
        next.push({ start: block.end, end: piece.end });
      }
    }
    pieces = next;
  }
  return pieces.filter((it) => it.end > it.start);
};

const overlapInterval = (a, b) => {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  if (end <= start) return null;
  return { start, end };
};

const buildDayIntensityFromAvailability = (availabilityUi) => {
  const out = {};
  for (const day of REVISION_DAYS) {
    const info = availabilityUi?.[day];
    const slots = info?.enabled && Array.isArray(info?.slots) ? info.slots : [];
    const minutes = slots.reduce((sum, slot) => {
      const start = timeToMinutes(slot?.start);
      const end = timeToMinutes(slot?.end);
      if (typeof start !== "number" || typeof end !== "number" || end <= start)
        return sum;
      return sum + (end - start);
    }, 0);

    let intensity = 1;
    if (minutes >= 180) intensity = 3;
    else if (minutes >= 90) intensity = 2;

    out[DAY_UI_TO_BACKEND[day] ?? day] = intensity;
  }
  return out;
};

const buildSubjectDurations = (subjects, coefficients, baseDuration) => {
  const base = clampNumber(Math.round(Number(baseDuration) || 60), 15, 180);
  const result = {};
  for (const subject of subjects) {
    const coeff = Math.max(0, Math.round(Number(coefficients?.[subject]) || 1));
    let duration = base;
    if (coeff >= 4) duration += 30;
    else if (coeff === 3) duration += 15;
    else if (coeff <= 1) duration -= 15;

    duration = clampNumber(duration, 15, 180);
    result[subject] = Math.max(15, Math.floor(duration / 5) * 5);
  }
  return result;
};

const buildExceptionalFreeSlots = (availabilityUi, existingNonRevision) => {
  const byDay = Object.fromEntries(REVISION_DAYS.map((d) => [d, []]));

  for (const day of REVISION_DAYS) {
    const info = availabilityUi?.[day];
    if (!info?.enabled) continue;
    const availSlots = Array.isArray(info?.slots) ? info.slots : [];

    const dayEvents = (
      Array.isArray(existingNonRevision) ? existingNonRevision : []
    )
      .filter((ev) => ev?.day === day)
      .map((ev) => ({ start: Number(ev?.startMin), end: Number(ev?.endMin) }))
      .filter(
        (ev) =>
          Number.isFinite(ev.start) &&
          Number.isFinite(ev.end) &&
          ev.end > ev.start,
      );

    for (const slot of availSlots) {
      const start = timeToMinutes(slot?.start);
      const end = timeToMinutes(slot?.end);
      if (typeof start !== "number" || typeof end !== "number" || end <= start)
        continue;

      const interval = { start, end };
      for (const busy of dayEvents) {
        const overlap = overlapInterval(interval, busy);
        if (overlap) byDay[day].push(overlap);
      }
    }

    byDay[day] = mergeIntervals(byDay[day]);
  }

  const extras = [];
  for (const day of REVISION_DAYS) {
    for (const slot of byDay[day]) {
      extras.push({
        day: DAY_UI_TO_BACKEND[day] ?? day,
        start: minutesToTime(slot.start),
        end: minutesToTime(slot.end),
      });
    }
  }
  return extras;
};

const parseBackendErrorDetail = (data, rawText, status) => {
  const backendDetailBody = data?.details?.body;
  const backendStatus = data?.details?.status;

  let geminiBody = null;
  if (typeof backendDetailBody === "string" && backendDetailBody.trim()) {
    geminiBody = backendDetailBody.trim();
    try {
      const parsed = JSON.parse(geminiBody);
      const fromGemini =
        parsed?.error?.message || parsed?.error?.status || parsed?.message;
      if (typeof fromGemini === "string" && fromGemini.trim()) {
        geminiBody = fromGemini.trim();
      }
    } catch {
      // Keep raw backend body when it's not JSON.
    }
  }

  const fallbackText =
    typeof rawText === "string" && rawText.trim()
      ? rawText.replace(/\s+/g, " ").trim().slice(0, 280)
      : null;

  const detail =
    geminiBody ||
    data?.details?.cause ||
    data?.error ||
    data?.message ||
    fallbackText;

  const upstreamStatus = backendStatus || null;
  const statusLabel = status ? ` (HTTP ${status})` : "";
  const upstreamLabel = upstreamStatus ? ` [Gemini ${upstreamStatus}]` : "";

  return detail
    ? `${detail}${statusLabel}${upstreamLabel}`
    : `Erreur lors de la suggestion IA.${statusLabel}${upstreamLabel}`;
};

const buildFallbackWarnings = (detail, status) => {
  const is429 = Number(status) === 429 || String(detail || "").includes("429");
  if (is429) {
    return [
      "Suggestion IA indisponible: Erreur lors de l'appel a Gemini (Gemini=HTTP 429)",
      "Suggestion IA indisponible, repartition heuristique appliquee.",
    ];
  }

  return [
    `Suggestion IA indisponible: ${detail || "Erreur backend"}`,
    "Suggestion IA indisponible, repartition heuristique appliquee.",
  ];
};

const stableSerialize = (value) => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableSerialize(value[k])}`).join(",")}}`;
};

const hashPayload = (payload) => {
  const str = stableSerialize(payload);
  let hash = 5381;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `${hash}:${str.length}`;
};

const isRevisionEvent = (ev) => {
  const type = String(ev?.type || "").toUpperCase();
  if (type === "REVISION") return true;

  const subject = String(ev?.subject || "")
    .trim()
    .toLowerCase();
  if (subject.startsWith("revision") || subject.startsWith("révision")) {
    return true;
  }

  const color = String(ev?.color || "");
  return color.includes("bg-purple-100");
};

const buildExamPriorityWeights = (subjects, coefficients, orderedExamSchedule) => {
  const weights = Object.fromEntries(
    (Array.isArray(subjects) ? subjects : []).map((subject) => [
      subject,
      Math.max(1, Number(coefficients?.[subject]) || 1),
    ]),
  );

  const totalExams = Array.isArray(orderedExamSchedule)
    ? orderedExamSchedule.length
    : 0;

  orderedExamSchedule.forEach((exam, index) => {
    const subject = String(exam?.subject || "").trim();
    if (!subject) return;
    const examPriorityBonus = Math.max(1, totalExams - index) * 3;
    weights[subject] = Math.max(1, Number(weights[subject]) || 1) + examPriorityBonus;
  });

  return weights;
};

const allocateSubjectCounts = (subjects, coefficients, capacity) => {
  const totalCapacity = Math.max(0, Math.floor(capacity));
  if (!Array.isArray(subjects) || subjects.length === 0 || totalCapacity <= 0) {
    return {};
  }

  const weights = subjects.map((subject) => ({
    subject,
    weight: Math.max(1, Number(coefficients?.[subject]) || 1),
  }));

  const counts = Object.fromEntries(subjects.map((s) => [s, 0]));

  if (totalCapacity >= subjects.length) {
    for (const subject of subjects) counts[subject] = 1;
  } else {
    const sorted = [...weights].sort((a, b) => b.weight - a.weight);
    for (let i = 0; i < totalCapacity; i += 1) counts[sorted[i].subject] += 1;
    return counts;
  }

  let remaining = totalCapacity - subjects.length;
  if (remaining <= 0) return counts;

  const totalWeight = weights.reduce((acc, item) => acc + item.weight, 0);
  const remainders = [];

  for (const item of weights) {
    const raw = (remaining * item.weight) / Math.max(1, totalWeight);
    const floor = Math.floor(raw);
    counts[item.subject] += floor;
    remaining -= floor;
    remainders.push({
      subject: item.subject,
      frac: raw - floor,
      weight: item.weight,
    });
  }

  remainders.sort((a, b) => b.frac - a.frac || b.weight - a.weight);
  for (let i = 0; i < remaining; i += 1) {
    const pick = remainders[i % remainders.length];
    counts[pick.subject] += 1;
  }

  return counts;
};

const buildRevisionEventsFrontend = ({
  planningType,
  subjects,
  coefficients,
  availabilityUi,
  existingNonRevision,
  sessionDuration,
  breakMinutes,
  weekDatesByDay,
  orderedExamSchedule = [],
}) => {
  const durationMin = Math.max(15, Math.floor(sessionDuration || 60));
  const pauseMin = clampNumber(
    Math.round(Number(breakMinutes) || DEFAULT_BREAK_MINUTES),
    10,
    15,
  );
  const occupiedByDay = Object.fromEntries(REVISION_DAYS.map((d) => [d, []]));

  for (const ev of Array.isArray(existingNonRevision)
    ? existingNonRevision
    : []) {
    if (!occupiedByDay[ev.day]) continue;
    const start = Number(ev?.startMin);
    const end = Number(ev?.endMin);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
      continue;
    occupiedByDay[ev.day].push({ start, end });
  }

  for (const day of REVISION_DAYS) {
    occupiedByDay[day] = mergeIntervals(occupiedByDay[day]);
  }

  const candidateSlots = [];
  for (const day of REVISION_DAYS) {
    const info = availabilityUi?.[day];
    if (!info?.enabled) continue;

    const slots = Array.isArray(info?.slots) ? info.slots : [];
    for (const slot of slots) {
      const start = timeToMinutes(slot?.start);
      const end = timeToMinutes(slot?.end);
      if (typeof start !== "number" || typeof end !== "number" || end <= start)
        continue;

      const freeIntervals = subtractIntervals(
        { start, end },
        occupiedByDay[day],
      );
      for (const free of freeIntervals) {
        let cursor = free.start;
        while (cursor + durationMin <= free.end) {
          candidateSlots.push({
            day,
            startMin: cursor,
            endMin: cursor + durationMin,
          });
          cursor += durationMin + pauseMin;
        }
      }
    }
  }

  if (candidateSlots.length === 0) {
    return {
      events: [],
      warnings: [
        "Aucun créneau libre trouvé avec les disponibilités actuelles.",
      ],
    };
  }

  const weightedCoefficients =
    planningType === PLANNING_TYPE.EXAM && orderedExamSchedule.length > 0
      ? buildExamPriorityWeights(subjects, coefficients, orderedExamSchedule)
      : coefficients;

  const counts = allocateSubjectCounts(
    subjects,
    weightedCoefficients,
    candidateSlots.length,
  );
  const remaining = { ...counts };

  const examRankBySubject = Object.fromEntries(
    orderedExamSchedule.map((exam, index) => [String(exam.subject || "").trim(), index + 1]),
  );

  const slotExamUrgency = (subject, slot) => {
    const rank = examRankBySubject[String(subject || "").trim()];
    if (planningType !== PLANNING_TYPE.EXAM || !rank) return 0;

    const slotDateBase =
      weekDatesByDay && slot?.day ? weekDatesByDay[slot.day] : null;
    const examInfo = orderedExamSchedule.find(
      (item) => String(item?.subject || "").trim() === String(subject || "").trim(),
    );
    const slotDate =
      slotDateBase instanceof Date
        ? addDays(slotDateBase, 0)
        : null;
    const examDate = parseIsoDate(examInfo?.examDate || "");

    if (!(slotDate instanceof Date) || !(examDate instanceof Date)) {
      return Math.max(0, 50 - rank * 5);
    }

    const diffDays = Math.round(
      (examDate.getTime() - slotDate.getTime()) / (24 * 60 * 60 * 1000),
    );

    return Math.max(0, 40 - diffDays) + Math.max(0, 20 - rank * 2);
  };

  const pickSubject = (slot) => {
    let best = null;
    for (const subject of subjects) {
      const left = remaining[subject] || 0;
      if (left <= 0) continue;
      const urgency = slotExamUrgency(subject, slot);
      if (
        !best ||
        urgency > best.urgency ||
        (urgency === best.urgency && left > best.left)
      ) {
        best = { subject, left, urgency };
      }
    }
    if (best) {
      remaining[best.subject] -= 1;
      return best.subject;
    }
    const fallback = subjects[0] || "Matière";
    return fallback;
  };

  const events = candidateSlots.map((slot) => {
    const subject = pickSubject(slot);
    return {
      id: makeId(),
      day: slot.day,
      startMin: slot.startMin,
      endMin: slot.endMin,
      subject: `Révision - ${subject}`,
      room: "Travail personnel",
      type: "REVISION",
      color: REVISION_COLOR_CLASS,
    };
  });

  return {
    events,
    warnings: [
      "Suggestion IA indisponible: génération locale appliquée à partir de vos disponibilités et coefficients.",
    ],
  };
};

export default function ScheduleView() {
  const [currentWeek, setCurrentWeek] = useState(0);

  const slotRef = useRef(null);
  const slotHeightPxRef = useRef(null);
  const interactionRef = useRef(null);
  const interactionMovedRef = useRef(false);

  const [activeEventId, setActiveEventId] = useState(null);
  const [activeMode, setActiveMode] = useState(null); // 'drag' | 'resize' | null

  // Avoid hydration mismatch: server cannot read localStorage, client can.
  // Start with a deterministic state, then hydrate from storage in effects.
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [hasImportedPlanning, setHasImportedPlanning] = useState(false);

  const dayLabel = {
    Monday: "Lundi",
    Tuesday: "Mardi",
    Wednesday: "Mercredi",
    Thursday: "Jeudi",
    Friday: "Vendredi",
    Saturday: "Samedi",
    Sunday: "Dimanche",
  };

  const snapMinutes = (minutes) => {
    const snapped = Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
    return snapped;
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const getEventColorClass = (event) => {
    const durationMinutes = Number(event?.endMin) - Number(event?.startMin);

    if (isRevisionEvent(event)) {
      return "bg-purple-100 border-purple-300 text-purple-900";
    }

    if (durationMinutes > 150) {
      return "bg-blue-100 border-blue-300 text-blue-900";
    }

    if (durationMinutes === 90) {
      return "bg-pink-100 border-pink-300 text-pink-900";
    }

    if (durationMinutes === 120) {
      return "bg-green-100 border-green-300 text-green-900";
    }

    if (durationMinutes === 60) {
      return "bg-orange-100 border-orange-300 text-orange-900";
    }

    return event?.color || "bg-slate-100 border-slate-300 text-slate-900";
  };

  const getEventPositionFromMinutes = (startMin, endMin) => {
    const topHours = (startMin - BASE_START_MIN) / 60;
    const heightHours = (endMin - startMin) / 60;
    return { top: `${topHours * 4}rem`, height: `${heightHours * 4}rem` };
  };

  const [planningMeta, setPlanningMeta] = useState({
    timezone: "Europe/Paris",
  });

  const [revisionAvailability, setRevisionAvailability] = useState(() =>
    defaultRevisionAvailability(),
  );
  /** Emploi « examens » vit sur /exam-schedule ; ici uniquement la semaine type cours/révisions. */
  const planningType = PLANNING_TYPE.NORMAL;
  const [revisionCoefficients, setRevisionCoefficients] = useState({});
  const [revisionSessionDuration, setRevisionSessionDuration] = useState(60);
  const [revisionError, setRevisionError] = useState(null);
  const [revisionWarnings, setRevisionWarnings] = useState([]);
  const [revisionAiLoading, setRevisionAiLoading] = useState(false);
  const [revisionCooldownUntil, setRevisionCooldownUntil] = useState(0);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [revisionModal, setRevisionModal] = useState(null); // 'availability' | 'coefficients' | null
  const [sessionModalEventId, setSessionModalEventId] = useState(null);
  const [sessionTitleInput, setSessionTitleInput] = useState("");
  const [sessionRoomInput, setSessionRoomInput] = useState("");
  const [sessionTodoInput, setSessionTodoInput] = useState("");
  const [sessionFormError, setSessionFormError] = useState(null);

  const aiInFlightRef = useRef(false);
  const revisionDbSyncHashRef = useRef(null);
  const revisionDbLoadInFlightRef = useRef(false);
  const aiPayloadCacheRef = useRef({
    hash: null,
    savedAt: 0,
    planned: [],
    warnings: [],
  });

  const normalizeUiEvent = (ev) => {
    const duration = ev.endMin - ev.startMin;
    const safeDuration = Math.max(MIN_DURATION_MINUTES, duration);
    const startMin = clamp(
      ev.startMin,
      BASE_START_MIN,
      BASE_END_MIN - safeDuration,
    );
    const endMin = clamp(
      startMin + safeDuration,
      startMin + MIN_DURATION_MINUTES,
      BASE_END_MIN,
    );
    return { ...ev, startMin, endMin };
  };

  const [events, setEvents] = useState([]);
  const [persistWarning, setPersistWarning] = useState(null);

  const selectedSessionEvent = useMemo(() => {
    if (!sessionModalEventId) return null;
    return (
      (Array.isArray(events) ? events : []).find(
        (ev) => ev?.id === sessionModalEventId,
      ) || null
    );
  }, [events, sessionModalEventId]);

  const openSessionModal = (eventId) => {
    const picked = (Array.isArray(events) ? events : []).find(
      (ev) => ev?.id === eventId,
    );
    if (!picked) return;

    setSessionModalEventId(eventId);
    setSessionTitleInput(String(picked?.subject || ""));
    setSessionRoomInput(String(picked?.room || ""));
    setSessionTodoInput("");
    setSessionFormError(null);
  };

  const closeSessionModal = () => {
    setSessionModalEventId(null);
    setSessionTitleInput("");
    setSessionRoomInput("");
    setSessionTodoInput("");
    setSessionFormError(null);
  };

  const saveSessionEdits = () => {
    if (!selectedSessionEvent) return;
    const nextTitle = String(sessionTitleInput || "").trim();
    if (!nextTitle) {
      setSessionFormError("Le titre de la séance est requis.");
      return;
    }

    setEvents((prev) =>
      (Array.isArray(prev) ? prev : []).map((ev) => {
        if (ev?.id !== selectedSessionEvent.id) return ev;
        return {
          ...ev,
          subject: nextTitle,
          room: String(sessionRoomInput || "").trim(),
        };
      }),
    );
    setSessionFormError(null);
    closeSessionModal();
  };

  const deleteSessionFromModal = () => {
    if (!selectedSessionEvent) return;
    setEvents((prev) =>
      Array.isArray(prev)
        ? prev.filter((ev) => ev?.id !== selectedSessionEvent.id)
        : [],
    );
    closeSessionModal();
  };

  const addRevisionTodo = () => {
    if (!selectedSessionEvent || !isRevisionEvent(selectedSessionEvent)) return;
    const label = String(sessionTodoInput || "").trim();
    if (!label) return;

    setEvents((prev) =>
      (Array.isArray(prev) ? prev : []).map((ev) => {
        if (ev?.id !== selectedSessionEvent.id) return ev;
        const todos = normalizeRevisionTodos(ev?.todos);
        return {
          ...ev,
          todos: [...todos, { id: makeId(), text: label, done: false }],
        };
      }),
    );
    setSessionTodoInput("");
  };

  const toggleRevisionTodo = (todoId) => {
    if (!selectedSessionEvent || !isRevisionEvent(selectedSessionEvent)) return;
    setEvents((prev) =>
      (Array.isArray(prev) ? prev : []).map((ev) => {
        if (ev?.id !== selectedSessionEvent.id) return ev;
        return {
          ...ev,
          todos: normalizeRevisionTodos(ev?.todos).map((todo) =>
            todo.id === todoId ? { ...todo, done: !todo.done } : todo,
          ),
        };
      }),
    );
  };

  const removeRevisionTodo = (todoId) => {
    if (!selectedSessionEvent || !isRevisionEvent(selectedSessionEvent)) return;
    setEvents((prev) =>
      (Array.isArray(prev) ? prev : []).map((ev) => {
        if (ev?.id !== selectedSessionEvent.id) return ev;
        return {
          ...ev,
          todos: normalizeRevisionTodos(ev?.todos).filter(
            (todo) => todo.id !== todoId,
          ),
        };
      }),
    );
  };

  const normalizedAvailability = useMemo(
    () => normalizeAvailabilityMap(revisionAvailability),
    [revisionAvailability],
  );

  const nonRevisionEvents = useMemo(
    () =>
      (Array.isArray(events) ? events : []).filter(
        (e) => e && !isRevisionEvent(e),
      ),
    [events],
  );

  const normalSubjects = useMemo(() => {
    const set = new Set(
      nonRevisionEvents
        .map((e) => String(e?.subject ?? "").trim())
        .filter((s) => s && !s.toLowerCase().startsWith("révision -")),
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [nonRevisionEvents]);

  const subjects = normalSubjects;

  const revisionCount = useMemo(
    () =>
      (Array.isArray(events) ? events : []).filter((e) => isRevisionEvent(e))
        .length,
    [events],
  );

  const revisionEvents = useMemo(
    () =>
      (Array.isArray(events) ? events : []).filter((e) => isRevisionEvent(e)),
    [events],
  );

  const todayWeekStart = useMemo(() => getMondayOfWeek(new Date()), []);
  const selectedWeekStart = useMemo(
    () => addDays(todayWeekStart, currentWeek * 7),
    [todayWeekStart, currentWeek],
  );
  const selectedWeekEnd = useMemo(
    () => addDays(selectedWeekStart, 6),
    [selectedWeekStart],
  );
  const weekRangeLabel = useMemo(
    () =>
      `Du ${formatShortFrDate(selectedWeekStart)} au ${formatShortFrDate(selectedWeekEnd)}`,
    [selectedWeekStart, selectedWeekEnd],
  );

  const weekDatesByDay = useMemo(() => {
    const entries = Object.entries(WEEKDAY_INDEX).map(([day, index]) => [
      day,
      addDays(selectedWeekStart, index),
    ]);
    return Object.fromEntries(entries);
  }, [selectedWeekStart]);

  const orderedExamSchedule = useMemo(() => [], []);
  const examModeBlockedReason = null;
  const revisionGenerationBaseEvents = nonRevisionEvents;

  useEffect(() => {
    if (!storageLoaded) return;
    saveRevisionPrefs({
      planningType: PLANNING_TYPE.NORMAL,
      examWeekStartDate: "",
      availability: normalizedAvailability,
      coefficients: revisionCoefficients,
      sessionDuration: revisionSessionDuration,
    });
  }, [
    normalizedAvailability,
    revisionCoefficients,
    revisionSessionDuration,
    storageLoaded,
  ]);

  useEffect(() => {
    if (!storageLoaded) return;
    if (!subjects.length) return;
    setRevisionCoefficients((prev) => {
      let changed = false;
      const next = { ...(prev || {}) };
      for (const s of subjects) {
        const val = next[s];
        if (!Number.isFinite(Number(val))) {
          next[s] = 1;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [subjects, storageLoaded]);

  useEffect(() => {
    if (!storageLoaded) return;
    if (!hasImportedPlanning) return;
    savePlanningToStorage(
      uiEventsToBackendPlanning(nonRevisionEvents, planningMeta.timezone),
    );
  }, [
    nonRevisionEvents,
    planningMeta.timezone,
    hasImportedPlanning,
    storageLoaded,
  ]);

  useEffect(() => {
    if (!storageLoaded) return;
    if (!hasImportedPlanning) return;

    const payload = {
      timezone: planningMeta.timezone,
      events: uiEventsToBackendPlanning(revisionEvents, planningMeta.timezone)
        .events,
    };
    const payloadHash = hashPayload(payload);
    if (revisionDbSyncHashRef.current === payloadHash) return;

    const timer = window.setTimeout(async () => {
      try {
        await apiFetch("/api/planning/revision-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        revisionDbSyncHashRef.current = payloadHash;
      } catch {
        // Keep UI responsive even when DB sync fails.
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [
    revisionEvents,
    planningMeta.timezone,
    hasImportedPlanning,
    storageLoaded,
  ]);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const w = window.sessionStorage.getItem("sp_timetable_persist_warning");
        if (w) {
          setPersistWarning(w);
          window.sessionStorage.removeItem("sp_timetable_persist_warning");
        }
      }
    } catch {
      // ignore
    }

    const refreshFromStorage = async () => {
      let stored = loadPlanningFromStorage();
      const localImported =
        Array.isArray(stored?.events) && stored.events.length > 0;

      if (!localImported) {
        try {
          const remote = await apiFetch("/api/me/timetables/latest");
          const remoteEvents = remote?.events;
          if (Array.isArray(remoteEvents) && remoteEvents.length > 0) {
            stored = {
              id: remote.id,
              timetableId: remote.id,
              timezone: remote.timezone || "Europe/Paris",
              warnings: remote.warnings || [],
              events: remoteEvents,
              sourceFileName: remote.sourceFileName,
            };
            savePlanningToStorage(stored);
            const meta = loadPlanningMeta() || {};
            savePlanningMeta({
              ...meta,
              timetableId: remote.id,
            });
          }
        } catch {
          // Not signed in or no timetable in MongoDB
        }
      }

      const imported =
        Array.isArray(stored?.events) && stored.events.length > 0;

      setPlanningMeta({
        timezone: stored?.timezone || "Europe/Paris",
      });

      if (!imported) {
        setHasImportedPlanning(false);
        setEvents([]);
        revisionDbSyncHashRef.current = null;
        setStorageLoaded(true);
        return;
      }

      setHasImportedPlanning(true);

      const fromStorage = backendPlanningToUiEvents(stored).filter(
        (ev) => !isRevisionEvent(ev),
      );

      let fromDbRevision = [];
      if (!revisionDbLoadInFlightRef.current) {
        revisionDbLoadInFlightRef.current = true;
        try {
          const dbData = await apiFetch("/api/planning/revision-sessions");
          const mapped = backendPlanningToUiEvents({
            events: Array.isArray(dbData?.events) ? dbData.events : [],
          });
          fromDbRevision = mapped.filter((ev) => isRevisionEvent(ev));
        } catch {
          fromDbRevision = [];
        } finally {
          revisionDbLoadInFlightRef.current = false;
        }
      }

      const merged = [...fromStorage, ...fromDbRevision].map(normalizeUiEvent);
      const revisionPayloadHash = hashPayload({
        timezone: stored?.timezone || "Europe/Paris",
        events: uiEventsToBackendPlanning(
          fromDbRevision,
          stored?.timezone || "Europe/Paris",
        ).events,
      });
      revisionDbSyncHashRef.current = revisionPayloadHash;

      setEvents(merged);
      setStorageLoaded(true);
    };

    const onFocus = () => refreshFromStorage();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshFromStorage();
    };

    // Initial refresh helps when the page is restored from cache.
    refreshFromStorage();

    // Load saved revision preferences once (avoid overwriting while user edits the form).
    const prefs = loadRevisionPrefs();
    if (prefs?.availability && typeof prefs.availability === "object") {
      setRevisionAvailability(normalizeAvailabilityMap(prefs.availability));
    }
    if (prefs?.coefficients && typeof prefs.coefficients === "object") {
      setRevisionCoefficients(prefs.coefficients);
    }
    if (typeof prefs?.sessionDuration === "number") {
      setRevisionSessionDuration(prefs.sessionDuration);
    }

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") setRevisionModal(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!revisionCooldownUntil || revisionCooldownUntil <= Date.now())
      return undefined;

    const timer = window.setInterval(() => {
      setClockNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [revisionCooldownUntil]);

  const revisionCooldownRemainingSec = Math.max(
    0,
    Math.ceil((revisionCooldownUntil - clockNow) / 1000),
  );

  const generateRevisionSessionsAi = async () => {
    if (aiInFlightRef.current || revisionAiLoading) return false;

    if (revisionCooldownUntil > Date.now()) {
      setRevisionError(
        `Trop de requêtes IA. Réessayez dans ${revisionCooldownRemainingSec}s.`,
      );
      return false;
    }

    aiInFlightRef.current = true;
    setRevisionError(null);
    setRevisionWarnings([]);
    if (!hasImportedPlanning) {
      aiInFlightRef.current = false;
      setRevisionError(
        "Aucun planning importé. Importez un fichier puis réessayez.",
      );
      return false;
    }
    if (!subjects.length) {
      aiInFlightRef.current = false;
      setRevisionError("Aucune matière détectée dans votre planning.");
      return false;
    }
    const durationMin = clamp(Number(revisionSessionDuration) || 60, 15, 180);
    const existingNonRevision = revisionGenerationBaseEvents;
    const persistedNonRevision = nonRevisionEvents;

    const availability = Object.fromEntries(
      REVISION_DAYS.map((day) => {
        const info = normalizedAvailability?.[day];
        const enabled = Boolean(info?.enabled);
        const slots = (Array.isArray(info?.slots) ? info.slots : [])
          .map((slot) => ({
            start: String(slot?.start || ""),
            end: String(slot?.end || ""),
          }))
          .filter((slot) => {
            const start = timeToMinutes(slot.start);
            const end = timeToMinutes(slot.end);
            return (
              typeof start === "number" &&
              typeof end === "number" &&
              end > start
            );
          })
          .sort((a, b) => {
            const aStart = timeToMinutes(a.start) ?? 0;
            const bStart = timeToMinutes(b.start) ?? 0;
            return aStart - bStart;
          });

        const firstSlot = slots[0] || defaultDaySlot(day);
        return [
          DAY_UI_TO_BACKEND[day] ?? day,
          {
            enabled,
            slots,
            start: firstSlot.start,
            end: firstSlot.end,
          },
        ];
      }),
    );
    const hasAnyEnabledAvailability = Object.values(availability).some(
      (v) =>
        v?.enabled === true && Array.isArray(v?.slots) && v.slots.length > 0,
    );
    if (!hasAnyEnabledAvailability) {
      setRevisionError(
        "Ajoutez au moins un créneau valide (début < fin) avant de lancer la suggestion IA.",
      );
      return false;
    }

    const coefficients = Object.fromEntries(
      subjects.map((subject) => {
        const raw = revisionCoefficients?.[subject];
        const n = Number(raw);
        const value = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 1;
        return [subject, value];
      }),
    );

    const existingEvents = existingNonRevision.map((ev) => ({
      day: DAY_UI_TO_BACKEND[ev.day] ?? ev.day,
      start: minutesToTime(ev.startMin),
      end: minutesToTime(ev.endMin),
      subject: ev.subject || "Matière",
      type: ev.type || "LECTURE",
    }));

    const breakMinutes = DEFAULT_BREAK_MINUTES;
    const dayIntensity = buildDayIntensityFromAvailability(
      normalizedAvailability,
    );
    const subjectDurationsMinutes = buildSubjectDurations(
      subjects,
      coefficients,
      durationMin,
    );
    const exceptionalFreeSlots = buildExceptionalFreeSlots(
      normalizedAvailability,
      existingNonRevision,
    );

    const payload = {
      timezone: planningMeta?.timezone || "Europe/Paris",
      planningType: PLANNING_TYPE.NORMAL,
      orderedExamSchedule,
      calendarContext: {
        selectedWeekStartDate: formatDateIso(selectedWeekStart),
        selectedWeekEndDate: formatDateIso(selectedWeekEnd),
      },
      revisionPolicy: { mode: "DEFAULT_WEEKLY" },

      sessionDurationMinutes: durationMin,
      breakMinutes,
      availability,
      dayIntensity,
      coefficients,
      subjectDurationsMinutes,
      exceptionalFreeSlots,
      existingEvents,
    };

    const payloadHash = hashPayload(payload);
    const cache = aiPayloadCacheRef.current;
    if (
      cache?.hash === payloadHash &&
      Date.now() - Number(cache?.savedAt || 0) <= AI_PAYLOAD_CACHE_TTL_MS &&
      Array.isArray(cache?.planned) &&
      cache.planned.length > 0
    ) {
      setRevisionWarnings([
        "Résultat réutilisé (payload inchangé).",
        ...(cache.warnings || []),
      ]);
      setEvents(
        [...persistedNonRevision, ...cache.planned].map(normalizeUiEvent),
      );
      aiInFlightRef.current = false;
      return true;
    }

    setRevisionAiLoading(true);
    try {
      // Fetch aiPromptContext from backend
      let aiPromptContext = null;
      try {
        const promptContextRequest = {
          planningType: PLANNING_TYPE.NORMAL,
          selectedWeekStartDate: formatDateIso(selectedWeekStart),
          selectedWeekEndDate: formatDateIso(selectedWeekEnd),
          examWeekStartDate: null,
          revisionWeekStartDate: null,
          revisionWeekEndDate: null,
          orderedExamSchedule,
        };

        const promptContextResponse = await apiFetch(
          "/api/planning/revision-prompt-context",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(promptContextRequest),
          }
        );

        aiPromptContext = promptContextResponse?.promptContext || null;
      } catch (promptErr) {
        console.warn("Failed to fetch aiPromptContext, continuing without it", promptErr);
      }

      // Add aiPromptContext to payload if available
      if (aiPromptContext) {
        payload.aiPromptContext = aiPromptContext;
      }

      let data = null;
      try {
        data = await apiFetch("/api/planning/revision-suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        const status = Number(err?.status) || null;
        const errorData = err?.data;
        const rawText = typeof err?.rawText === "string" ? err.rawText : "";

        if (status === 429) {
          const nextCooldownUntil = Date.now() + AI_RATE_LIMIT_COOLDOWN_MS;
          setRevisionCooldownUntil(nextCooldownUntil);
        }

        const detail = parseBackendErrorDetail(errorData, rawText, status);

        const fallback = buildRevisionEventsFrontend({
          planningType,
          subjects,
          coefficients,
          availabilityUi: normalizedAvailability,
          existingNonRevision,
          sessionDuration: durationMin,
          breakMinutes,
          weekDatesByDay,
          orderedExamSchedule,
        });

        if (fallback.events.length > 0) {
          const nextWarnings = buildFallbackWarnings(detail, status);
          setRevisionWarnings(nextWarnings);
          aiPayloadCacheRef.current = {
            hash: payloadHash,
            savedAt: Date.now(),
            planned: fallback.events,
            warnings: nextWarnings,
          };
          setEvents(
            [...persistedNonRevision, ...fallback.events].map(normalizeUiEvent),
          );
          return true;
        }

        throw new Error(detail);
      }

      if (!data || typeof data !== "object") {
        throw new Error("La suggestion IA a retourné une réponse invalide.");
      }

      const planned = backendPlanningToUiEvents({ events: data.events || [] });
      if (!planned.length) {
        throw new Error(
          "La suggestion IA n’a retourné aucun créneau exploitable.",
        );
      }

      if (Array.isArray(data.warnings) && data.warnings.length > 0) {
        setRevisionWarnings(data.warnings);
      }

      aiPayloadCacheRef.current = {
        hash: payloadHash,
        savedAt: Date.now(),
        planned,
        warnings: Array.isArray(data.warnings) ? data.warnings : [],
      };

      setEvents([...persistedNonRevision, ...planned].map(normalizeUiEvent));
      return true;
    } catch (e) {
      const fallback = buildRevisionEventsFrontend({
        planningType,
        subjects,
        coefficients,
        availabilityUi: normalizedAvailability,
        existingNonRevision,
        sessionDuration: durationMin,
        breakMinutes,
        weekDatesByDay,
        orderedExamSchedule,
      });

      if (fallback.events.length > 0) {
        const nextWarnings = buildFallbackWarnings(
          e?.message || "Erreur IA distante.",
          null,
        );
        setRevisionWarnings(nextWarnings);
        setRevisionError(null);
        aiPayloadCacheRef.current = {
          hash: payloadHash,
          savedAt: Date.now(),
          planned: fallback.events,
          warnings: nextWarnings,
        };
        setEvents(
          [...persistedNonRevision, ...fallback.events].map(normalizeUiEvent),
        );
        return true;
      }

      setRevisionError(e?.message || "Erreur lors de la suggestion IA.");
      return false;
    } finally {
      setRevisionAiLoading(false);
      aiInFlightRef.current = false;
    }
  };

  const visibleDays = useMemo(() => {
    const daysInEvents = new Set(
      (Array.isArray(events) ? events : [])
        .map((ev) => ev?.day)
        .filter(Boolean),
    );
    const includeWeekend = WEEKEND_DAYS.some((d) => daysInEvents.has(d));
    return includeWeekend
      ? [...DEFAULT_WEEK_DAYS, ...WEEKEND_DAYS]
      : DEFAULT_WEEK_DAYS;
  }, [events]);

  const visibleDaysWithDates = useMemo(
    () =>
      visibleDays.map((day) => ({
        day,
        date: weekDatesByDay?.[day] ?? null,
      })),
    [visibleDays, weekDatesByDay],
  );

  const eventsByDay = useMemo(() => {
    const map = Object.fromEntries(visibleDays.map((d) => [d, []]));

    for (const day of visibleDays) {
      const dayEvents = (Array.isArray(events) ? events : []).filter(
        (ev) => ev?.day === day,
      );
      const revisionIntervals = dayEvents
        .filter((ev) => isRevisionEvent(ev))
        .map((ev) => ({ start: ev.startMin, end: ev.endMin }))
        .filter(
          (it) =>
            Number.isFinite(it.start) &&
            Number.isFinite(it.end) &&
            it.end > it.start,
        );

      const mergedRevisionIntervals = mergeIntervals(revisionIntervals);

      for (const ev of dayEvents) {
        if (isRevisionEvent(ev)) {
          map[day].push({
            ...ev,
            type: "REVISION",
            color: REVISION_COLOR_CLASS,
            originalId: ev.id,
            isClippedSegment: false,
          });
          continue;
        }

        const hasAnyOverlap = mergedRevisionIntervals.some((rev) => {
          const start = Math.max(ev.startMin, rev.start);
          const end = Math.min(ev.endMin, rev.end);
          return end > start;
        });

        if (hasAnyOverlap) continue;

        map[day].push({
          ...ev,
          originalId: ev.id,
          isClippedSegment: false,
        });
      }

      map[day].sort((a, b) => {
        if (a.startMin !== b.startMin) return a.startMin - b.startMin;
        if (isRevisionEvent(a) && !isRevisionEvent(b)) return -1;
        if (!isRevisionEvent(a) && isRevisionEvent(b)) return 1;
        return 0;
      });
    }

    return map;
  }, [events, visibleDays]);

  useEffect(() => {
    if (!slotRef.current) return;
    slotHeightPxRef.current = slotRef.current.getBoundingClientRect().height;
  }, []);

  useEffect(() => {
    const onPointerMove = (e) => {
      const interaction = interactionRef.current;
      if (!interaction) return;
      if (
        typeof slotHeightPxRef.current !== "number" ||
        slotHeightPxRef.current <= 0
      )
        return;

      const dayEl = (() => {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        let cur = el;
        while (cur && !(cur instanceof HTMLElement)) cur = null;
        while (cur && !cur.dataset?.day) cur = cur.parentElement;
        return cur;
      })();

      const nextDay = dayEl?.dataset?.day ?? interaction.day;
      const dayBodyEl =
        dayEl ?? document.querySelector(`[data-day="${interaction.day}"]`);
      if (!(dayBodyEl instanceof HTMLElement)) return;

      const rect = dayBodyEl.getBoundingClientRect();
      const yPx = e.clientY - rect.top - interaction.offsetYPx;
      const minutesFromStart = (yPx / slotHeightPxRef.current) * 60;
      const snappedStartMin = BASE_START_MIN + snapMinutes(minutesFromStart);
      interactionMovedRef.current = true;

      if (interaction.type === "drag") {
        setEvents((prev) =>
          prev.map((ev) => {
            if (ev.id !== interaction.eventId) return ev;
            const duration = ev.endMin - ev.startMin;
            const startMin = clamp(
              snappedStartMin,
              BASE_START_MIN,
              BASE_END_MIN - duration,
            );
            const endMin = startMin + duration;
            return { ...ev, day: nextDay, startMin, endMin };
          }),
        );
      }

      if (interaction.type === "resize") {
        setEvents((prev) =>
          prev.map((ev) => {
            if (ev.id !== interaction.eventId) return ev;
            const rawEndMin =
              BASE_START_MIN +
              snapMinutes(
                ((e.clientY - rect.top) / slotHeightPxRef.current) * 60,
              );
            const clampedEndMin = clamp(
              rawEndMin,
              ev.startMin + MIN_DURATION_MINUTES,
              BASE_END_MIN,
            );
            return { ...ev, endMin: clampedEndMin };
          }),
        );
      }
    };

    const onPointerUp = () => {
      if (!interactionRef.current) return;
      interactionRef.current = null;
      setActiveEventId(null);
      setActiveMode(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [BASE_END_MIN, BASE_START_MIN]);

  const startDrag = (e, eventId, day) => {
    if (!(e.currentTarget instanceof HTMLElement)) return;
    if (e.button !== undefined && e.button !== 0) return;

    const eventEl = e.currentTarget;
    const rect = eventEl.getBoundingClientRect();
    const offsetYPx = e.clientY - rect.top;

    interactionRef.current = {
      type: "drag",
      eventId,
      day,
      offsetYPx,
    };
    interactionMovedRef.current = false;
    setActiveEventId(eventId);
    setActiveMode("drag");
    eventEl.setPointerCapture?.(e.pointerId);
  };

  const startResize = (e, eventId, day) => {
    e.stopPropagation();
    if (e.button !== undefined && e.button !== 0) return;

    interactionRef.current = {
      type: "resize",
      eventId,
      day,
      offsetYPx: 0,
    };
    interactionMovedRef.current = false;
    setActiveEventId(eventId);
    setActiveMode("resize");
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
  };

  const gridTemplateColumns = `6rem repeat(${visibleDays.length}, minmax(0, 1fr))`;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Mon emploi du temps
          </h1>
          <p className="text-slate-500 mt-1">
            {hasImportedPlanning
              ? "Votre planning hebdomadaire"
              : "Aucun planning importé — importez un fichier pour voir votre emploi du temps."}
          </p>
          {hasImportedPlanning && (
            <p className="text-sm text-slate-500 mt-1">
              {events.length} événement{events.length > 1 ? "s" : ""} importé
              {events.length > 1 ? "s" : ""}
              {planningMeta?.timezone ? ` · ${planningMeta.timezone}` : ""}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentWeek(currentWeek - 1)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Semaine précédente"
            >
              <ChevronLeft className="w-5 h-5 text-slate-700" />
            </button>
            <div className="text-right">
              <p className="text-sm font-medium text-slate-700">{weekRangeLabel}</p>
              <p className="text-xs text-slate-500">
                {currentWeek === 0
                  ? "Semaine courante"
                  : `${currentWeek > 0 ? "+" : ""}${currentWeek} semaine${Math.abs(currentWeek) > 1 ? "s" : ""}`}
              </p>
            </div>
            <button
              onClick={() => setCurrentWeek(currentWeek + 1)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Semaine suivante"
            >
              <ChevronRight className="w-5 h-5 text-slate-700" />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/exam-schedule"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-primary-800 hover:bg-slate-50"
            >
              Mon emploi des examens
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRevisionModal("availability")}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              disabled={!storageLoaded || !hasImportedPlanning}
            >
              Disponibilités
            </button>
            <button
              type="button"
              onClick={() => setRevisionModal("coefficients")}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              disabled={!storageLoaded || !hasImportedPlanning}
            >
              Ajouter coefficients
            </button>
            <button
              type="button"
              onClick={generateRevisionSessionsAi}
              className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
              disabled={
                !storageLoaded ||
                !hasImportedPlanning ||
                revisionAiLoading ||
                revisionCooldownRemainingSec > 0
              }
            >
              {revisionAiLoading
                ? "en cours…"
                : revisionCooldownRemainingSec > 0
                  ? `Patientez ${revisionCooldownRemainingSec}s`
                  : "Générer Séances de révisions"}
            </button>
          </div>
        </div>
      </div>

      {persistWarning && (
        <div className="bg-white border border-amber-200 rounded-lg p-3 text-sm text-amber-900 flex items-start justify-between gap-3">
          <p>
            <span className="font-semibold">Sauvegarde serveur : </span>
            {persistWarning}
          </p>
          <button
            type="button"
            onClick={() => setPersistWarning(null)}
            className="shrink-0 rounded-md border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-50"
          >
            Fermer
          </button>
        </div>
      )}

      {revisionError && (
        <div className="bg-white border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {revisionError}
        </div>
      )}

      {revisionWarnings.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
          <p className="font-medium">Avertissements IA :</p>
          <ul className="mt-1 list-disc list-inside space-y-1">
            {revisionWarnings.slice(0, 3).map((w, idx) => (
              <li key={`${w}-${idx}`}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {hasImportedPlanning && revisionCount > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-3 text-sm text-slate-700">
          {revisionCount} séance{revisionCount > 1 ? "s" : ""} de révision
          planifiée{revisionCount > 1 ? "s" : ""}.
        </div>
      )}

      <RevisionAvailabilityModal
        open={revisionModal === "availability"}
        onClose={() => setRevisionModal(null)}
        days={REVISION_DAYS}
        dayLabel={dayLabel}
        availability={normalizedAvailability}
        setAvailability={setRevisionAvailability}
        sessionDuration={revisionSessionDuration}
        setSessionDuration={setRevisionSessionDuration}
      />

      <RevisionCoefficientsModal
        open={revisionModal === "coefficients"}
        onClose={() => setRevisionModal(null)}
        subjects={subjects}
        coefficients={revisionCoefficients}
        setCoefficients={setRevisionCoefficients}
      />

      {selectedSessionEvent && (
        <ModalShell title="Détails de la séance" onClose={closeSessionModal}>
          <div className="space-y-4">
            <div>
              <label
                className="text-sm font-semibold text-slate-700"
                htmlFor="session-title"
              >
                Titre
              </label>
              <input
                id="session-title"
                value={sessionTitleInput}
                onChange={(e) => setSessionTitleInput(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="Titre de la séance"
              />
            </div>

            <div>
              <label
                className="text-sm font-semibold text-slate-700"
                htmlFor="session-room"
              >
                Salle
              </label>
              <input
                id="session-room"
                value={sessionRoomInput}
                onChange={(e) => setSessionRoomInput(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="Ex: Salle B12"
              />
            </div>

            {isRevisionEvent(selectedSessionEvent) && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-800">
                  Contenu de révision (to-do)
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    value={sessionTodoInput}
                    onChange={(e) => setSessionTodoInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addRevisionTodo();
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    placeholder="Ajouter un chapitre ou une leçon"
                  />
                  <button
                    type="button"
                    onClick={addRevisionTodo}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Ajouter
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {normalizeRevisionTodos(selectedSessionEvent?.todos)
                    .length === 0 && (
                    <p className="text-xs text-slate-500">
                      Aucun item pour le moment.
                    </p>
                  )}
                  {normalizeRevisionTodos(selectedSessionEvent?.todos).map(
                    (todo) => (
                      <div
                        key={todo.id}
                        className="flex items-center justify-between rounded-md bg-white px-2 py-1.5 border border-slate-200"
                      >
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={todo.done}
                            onChange={() => toggleRevisionTodo(todo.id)}
                            className="h-4 w-4"
                          />
                          <span
                            className={
                              todo.done ? "line-through text-slate-400" : ""
                            }
                          >
                            {todo.text}
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeRevisionTodo(todo.id)}
                          className="rounded px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                          aria-label="Supprimer l'item"
                        >
                          Supprimer
                        </button>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

            {sessionFormError && (
              <p className="text-sm text-red-600">{sessionFormError}</p>
            )}

            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={deleteSessionFromModal}
                className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
              >
                Supprimer la séance
              </button>
              <button
                type="button"
                onClick={saveSessionEdits}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div
          className="grid border-b border-slate-200"
          style={{ gridTemplateColumns }}
        >
          <div className="relative h-20 w-full border-r border-slate-200 bg-slate-50">
            <svg
              className="absolute inset-0 h-full w-full pointer-events-none"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <line
                x1="0"
                y1="0"
                x2="100"
                y2="100"
                stroke="rgb(203 213 225)"
                strokeWidth="1.5"
              />
            </svg>

            <span className="absolute top-2 right-2 text-xs text-slate-500">
              Jour
            </span>
            <span className="absolute bottom-2 left-2 text-xs text-slate-500">
              Heure
            </span>
          </div>
          {visibleDaysWithDates.map(({ day, date }) => (
            <div
              key={day}
              className="p-4 border-r border-slate-200 last:border-r-0 text-center"
            >
              <p className="font-medium text-slate-800">{dayLabel[day] ?? day}</p>
              {date instanceof Date && (
                <p className="text-xs text-slate-500 mt-1">{formatShortFrDate(date)}</p>
              )}
            </div>
          ))}
        </div>

        <div className="grid relative" style={{ gridTemplateColumns }}>
          <div className="border-r border-slate-200">
            {TIME_SLOTS.map((time, idx) => (
              <div
                key={time}
                ref={idx === 0 ? slotRef : null}
                className="h-16 border-b border-slate-200 p-2 text-sm text-slate-500"
              >
                {time}
              </div>
            ))}
          </div>

          {visibleDaysWithDates.map(({ day }) => (
            <div
              key={day}
              data-day={day}
              className="border-r border-slate-200 last:border-r-0 relative"
            >
              {TIME_SLOTS.map((time) => (
                <div key={time} className="h-16 border-b border-slate-200" />
              ))}
              <div className="absolute inset-0 pointer-events-none">
                {eventsByDay[day]?.map((event) => {
                  const position = getEventPositionFromMinutes(
                    event.startMin,
                    event.endMin,
                  );
                  const eventControlId = event.originalId || event.id;
                  const isActive = activeEventId === eventControlId;
                  const isShortRevisionSession =
                    isRevisionEvent(event) &&
                    event.endMin - event.startMin < 120;
                  const eventColorClass = getEventColorClass(event);
                  const eventFontClass = isRevisionEvent(event)
                    ? "font-bold"
                    : "font-medium";
                  const cursorClass =
                    isActive && activeMode === "drag"
                      ? "cursor-grabbing"
                      : "cursor-grab";
                  return (
                    <div
                      key={event.id}
                      onPointerDown={(e) => startDrag(e, eventControlId, day)}
                      onClick={() => {
                        if (interactionMovedRef.current) {
                          interactionMovedRef.current = false;
                          return;
                        }
                        openSessionModal(eventControlId);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openSessionModal(eventControlId);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      title={isShortRevisionSession ? event.subject : undefined}
                      aria-label={event.subject}
                      className={`group absolute left-1 right-1 ${eventColorClass} ${eventFontClass} border rounded-lg p-2 pr-8 pointer-events-auto hover:shadow-md transition-shadow select-none touch-none ${cursorClass} ${isActive ? "ring-2 ring-slate-400/40" : ""}`}
                      style={{ top: position.top, height: position.height }}
                    >
                      {!isShortRevisionSession && (
                        <p
                          className="text-sm leading-tight"
                        >
                          {event.subject}
                        </p>
                      )}
                      <p className="text-xs opacity-80 mt-0.5">
                        {TYPE_LABEL_FR[event.type] ?? event.type}
                      </p>
                      <p className="text-xs opacity-80">{event.room}</p>
                      <p className="text-xs opacity-60 mt-1">
                        {minutesToTime(event.startMin)} -{" "}
                        {minutesToTime(event.endMin)}
                      </p>

                      

                      <div
                        onPointerDown={(e) =>
                          startResize(e, eventControlId, day)
                        }
                        data-resize-handle
                        className={`absolute left-0 right-0 bottom-0 h-2 rounded-b-lg pointer-events-auto ${isActive && activeMode === "resize" ? "cursor-ns-resize" : "cursor-ns-resize"}`}
                        aria-label="Redimensionner"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
