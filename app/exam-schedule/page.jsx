"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, CalendarRange, GraduationCap, Trash2 } from "lucide-react";
import {
  loadExamSmartSnapshot,
  saveExamSmartSnapshot,
  clearExamSmartSnapshot,
  timeToMinutes,
  minutesToTime,
  TYPE_LABEL_FR,
} from "@/lib/planningStorage";
import { apiFetch } from "@/lib/apiClient";

const BASE_START_MIN = 8 * 60;
const BASE_END_MIN = 23 * 60;

const TIME_SLOTS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00",
  "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00",
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const formatShortFrDate = (iso) => {
  if (!ISO_DATE.test(String(iso || ""))) return "—";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
};

const addDaysIso = (iso, delta) => {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const normalizeType = (ev) => {
  const t = String(ev?.type || ev?.sessionType || "")
    .trim()
    .toUpperCase();
  if (t === "EXAM" || t === "EXAMEN") return "EXAM";
  if (t === "REVISION" || t === "RÉVISION") return "REVISION";
  return t || "OTHER";
};

/** Backend smart events use ISO date in `day`. */
function parseSmartEvent(ev, idx) {
  const rawDay = String(ev?.day || ev?.date || "").trim();
  if (!ISO_DATE.test(rawDay)) return null;
  const startMin =
    timeToMinutes(ev?.start) ??
    (typeof ev?.startMin === "number" ? ev.startMin : null);
  const endMin =
    timeToMinutes(ev?.end) ??
    (typeof ev?.endMin === "number" ? ev.endMin : null);
  if (typeof startMin !== "number" || typeof endMin !== "number" || endMin <= startMin) {
    return null;
  }
  const type = normalizeType(ev);
  return {
    id: String(ev?.id || `ev-${idx}`),
    dateIso: rawDay,
    startMin,
    endMin,
    subject: String(ev?.subject || "").trim() || "Sans titre",
    room: String(ev?.room || "").trim(),
    type,
  };
}

const getEventPositionFromMinutes = (startMin, endMin) => {
  const topHours = (startMin - BASE_START_MIN) / 60;
  const heightHours = (endMin - startMin) / 60;
  return { top: `${topHours * 4}rem`, height: `${heightHours * 4}rem` };
};

const colorForType = (type) => {
  if (type === "EXAM") return "bg-red-100 border-red-300 text-red-900";
  if (type === "REVISION") return "bg-purple-100 border-purple-300 text-purple-900";
  return "bg-slate-100 border-slate-300 text-slate-900";
};

export default function ExamSchedulePage() {
  const [snapshot, setSnapshot] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [refetchError, setRefetchError] = useState(null);

  const refresh = () => {
    setSnapshot(loadExamSmartSnapshot());
    setLoaded(true);
  };

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const parsedEvents = useMemo(() => {
    const raw = Array.isArray(snapshot?.events) ? snapshot.events : [];
    return raw.map(parseSmartEvent).filter(Boolean);
  }, [snapshot]);

  const dates = useMemo(() => {
    const set = new Set(parsedEvents.map((e) => e.dateIso));
    return Array.from(set).sort();
  }, [parsedEvents]);

  const examEvents = useMemo(
    () => parsedEvents.filter((e) => e.type === "EXAM"),
    [parsedEvents],
  );
  const revisionEvents = useMemo(
    () => parsedEvents.filter((e) => e.type === "REVISION"),
    [parsedEvents],
  );

  const examPeriod = snapshot?.examPeriod || null;
  const revisionPeriod = snapshot?.revisionPeriod || null;

  const revisionSummary = useMemo(() => {
    if (!revisionPeriod?.enabled) {
      return {
        enabled: false,
        text: "Aucune période de révision dédiée n’est activée. Seules les révisions immédiates (même jour ou période d’examens) apparaissent dans le planning généré.",
      };
    }
    const a = revisionPeriod.startDate;
    const b = revisionPeriod.endDate;
    if (a && b) {
      return {
        enabled: true,
        text: `Période de révision activée : du ${formatShortFrDate(a)} au ${formatShortFrDate(b)}. Les créneaux de révision avant les épreuves sont listés ci‑dessous avec les examens concernés.`,
      };
    }
    return {
      enabled: true,
      text: "Période de révision activée (dates à compléter dans Gestion des examens).",
    };
  }, [revisionPeriod]);

  const examNarratives = useMemo(() => {
    const sorted = [...examEvents].sort(
      (a, b) =>
        a.dateIso.localeCompare(b.dateIso) || a.startMin - b.startMin,
    );
    return sorted.map((exam) => {
      const prevIso = addDaysIso(exam.dateIso, -1);
      const revSameDay = revisionEvents.filter(
        (r) => r.dateIso === exam.dateIso && r.endMin <= exam.startMin,
      );
      const revDayBefore = prevIso
        ? revisionEvents.filter((r) => r.dateIso === prevIso)
        : [];

      const parts = [];
      if (revDayBefore.length) {
        parts.push(
          `La veille (${formatShortFrDate(prevIso)}) : ${revDayBefore.length} créneau(x) de révision lié(s) à cette matière ou aux examens à venir.`,
        );
      }
      if (revSameDay.length) {
        parts.push(
          `Le jour J, avant la fin de l’épreuve (${minutesToTime(exam.startMin)}–${minutesToTime(exam.endMin)}) : ${revSameDay.length} session(s) de révision le matin ou avant l’examen.`,
        );
      }
      if (!parts.length) {
        parts.push(
          revisionPeriod?.enabled
            ? "Révisions : consultez les créneaux violets sur la grille ou dans la liste des révisions."
            : "Sans période de révision activée, le backend propose surtout des révisions le jour des examens.",
        );
      }

      return {
        exam,
        lines: parts,
      };
    });
  }, [examEvents, revisionEvents, revisionPeriod]);

  const handleRefetch = async () => {
    const tid = snapshot?.timetableId;
    if (!tid) return;
    setRefetchError(null);
    try {
      const data = await apiFetch(
        `/api/planning/smart?timetableId=${encodeURIComponent(tid)}`,
      );
      const events = Array.isArray(data?.events) ? data.events : [];
      const next = {
        ...snapshot,
        events,
        savedAt: new Date().toISOString(),
      };
      saveExamSmartSnapshot(next);
      setSnapshot(next);
    } catch (e) {
      setRefetchError(e?.message || "Impossible de recharger le planning.");
    }
  };

  const gridTemplateColumns = `6rem repeat(${Math.max(1, dates.length)}, minmax(0, 1fr))`;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-100 text-primary-800">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Mon emploi des examens
              </h1>
              <p className="mt-1 text-slate-500">
                Planning généré (épreuves et révisions) après « Générer le planning smart »
                sur la page Gestion des examens.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {snapshot?.timetableId ? (
            <button
              type="button"
              onClick={handleRefetch}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Actualiser depuis le serveur
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              clearExamSmartSnapshot();
              setSnapshot(null);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100"
          >
            <Trash2 className="h-4 w-4" />
            Effacer l’aperçu local
          </button>
          <Link
            href="/exams"
            className="rounded-lg bg-primary-800 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-900"
          >
            Gestion des examens
          </Link>
        </div>
      </div>

      {refetchError ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {refetchError}
        </div>
      ) : null}

      {!loaded ? null : !snapshot?.events?.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <p className="font-medium">Aucun planning d’examens enregistré.</p>
          <p className="mt-2 text-sm">
            Enregistrez vos examens, puis cliquez sur <strong>Générer le planning smart</strong>{" "}
            — vous serez redirigé ici automatiquement.
          </p>
          <Link
            href="/exams"
            className="mt-4 inline-block text-sm font-semibold text-primary-800 underline"
          >
            Aller à la gestion des examens
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-slate-800">
                <CalendarRange className="h-5 w-5 text-primary-800" />
                <h2 className="text-lg font-bold">Calendrier examens & révisions</h2>
              </div>
              {examPeriod?.startDate && examPeriod?.endDate ? (
                <p className="mb-4 text-sm text-slate-500">
                  Période d’examens enregistrée : du{" "}
                  <strong>{formatShortFrDate(examPeriod.startDate)}</strong> au{" "}
                  <strong>{formatShortFrDate(examPeriod.endDate)}</strong>
                </p>
              ) : null}

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <div
                  className="grid min-w-[720px] border-b border-slate-200 bg-slate-50"
                  style={{ gridTemplateColumns }}
                >
                  <div className="h-16 border-r border-slate-200" />
                  {dates.map((d) => (
                    <div
                      key={d}
                      className="border-r border-slate-200 p-2 text-center last:border-r-0"
                    >
                      <p className="text-xs font-semibold capitalize text-slate-800">
                        {formatShortFrDate(d)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="grid relative min-w-[720px]" style={{ gridTemplateColumns }}>
                  <div className="border-r border-slate-200">
                    {TIME_SLOTS.map((time) => (
                      <div
                        key={time}
                        className="h-16 border-b border-slate-200 p-2 text-sm text-slate-500"
                      >
                        {time}
                      </div>
                    ))}
                  </div>
                  {dates.map((d) => (
                    <div
                      key={d}
                      className="border-r border-slate-200 last:border-r-0 relative"
                    >
                      {TIME_SLOTS.map((time) => (
                        <div key={time} className="h-16 border-b border-slate-200" />
                      ))}
                      <div className="absolute inset-0 pointer-events-none">
                        {parsedEvents
                          .filter((e) => e.dateIso === d)
                          .map((event) => {
                            const pos = getEventPositionFromMinutes(
                              event.startMin,
                              event.endMin,
                            );
                            return (
                              <div
                                key={event.id}
                                className={`absolute left-1 right-1 rounded-lg border p-2 pointer-events-auto shadow-sm ${colorForType(event.type)}`}
                                style={{ top: pos.top, height: pos.height }}
                              >
                                <p className="text-xs font-semibold leading-tight">
                                  {event.subject}
                                </p>
                                <p className="text-[10px] opacity-80">
                                  {TYPE_LABEL_FR[event.type] || event.type}
                                </p>
                                <p className="text-[10px] opacity-70">
                                  {minutesToTime(event.startMin)} –{" "}
                                  {minutesToTime(event.endMin)}
                                </p>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900">Période de révision</h3>
                <p className="mt-2 text-sm text-slate-600">{revisionSummary.text}</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900">
                  Plan de révision par épreuve
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Indications basées sur les horaires de fin d’examen, la veille et les créneaux
                  générés le jour J.
                </p>
                <ul className="mt-3 space-y-3 text-sm text-slate-700">
                  {examNarratives.length === 0 ? (
                    <li>Aucun examen dans ce planning.</li>
                  ) : (
                    examNarratives.map(({ exam, lines }) => (
                      <li
                        key={exam.id}
                        className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                      >
                        <p className="font-semibold text-slate-900">
                          {exam.subject}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatShortFrDate(exam.dateIso)} · fin d’épreuve à{" "}
                          {minutesToTime(exam.endMin)}
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600">
                          {lines.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900">Révisions (liste)</h3>
                <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-xs text-slate-600">
                  {revisionEvents.length === 0 ? (
                    <li>Aucun créneau de révision dans ce planning.</li>
                  ) : (
                    revisionEvents
                      .sort(
                        (a, b) =>
                          a.dateIso.localeCompare(b.dateIso) || a.startMin - b.startMin,
                      )
                      .map((r) => (
                        <li key={r.id} className="rounded border border-slate-100 p-2">
                          <span className="font-medium text-slate-800">{r.subject}</span>
                          <br />
                          {formatShortFrDate(r.dateIso)} · {minutesToTime(r.startMin)} –{" "}
                          {minutesToTime(r.endMin)}
                        </li>
                      ))
                  )}
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
