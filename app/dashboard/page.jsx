"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Calendar,
  CalendarRange,
  ChevronRight,
  Clock,
  GraduationCap,
  LayoutDashboard,
  Sparkles,
  Upload,
} from "lucide-react";
import {
  loadExtractionState,
  loadPlanningFromStorage,
  loadPlanningMeta,
} from "@/lib/planningStorage";
import { getCurrentUser } from "@/lib/studentAuth";

const normalizeType = (value) => String(value || "").trim().toUpperCase();

const getEventType = (event) => {
  const type = normalizeType(event?.type);
  if (type === "EXAM") return "EXAM";
  if (type === "REVISION") return "REVISION";
  return "COURSE";
};

export default function DashboardPage() {
  const [now, setNow] = useState(() => new Date());
  const [tick, setTick] = useState(0);

  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onFocus = () => refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const snapshot = useMemo(() => {
    void tick;
    const user = getCurrentUser();
    const planning = loadPlanningFromStorage();
    const meta = loadPlanningMeta();
    const extraction = loadExtractionState();
    const events = Array.isArray(planning?.events) ? planning.events : [];
    let courses = 0;
    let exams = 0;
    let revisions = 0;
    for (const ev of events) {
      const t = getEventType(ev);
      if (t === "EXAM") exams += 1;
      else if (t === "REVISION") revisions += 1;
      else courses += 1;
    }
    const displayName =
      (typeof user?.name === "string" && user.name.trim()) ||
      (typeof user?.fullName === "string" && user.fullName.trim()) ||
      "Etudiant";
    return {
      user,
      displayName,
      eventCount: events.length,
      courses,
      exams,
      revisions,
      hasPlanning: events.length > 0,
      meta,
      extractionRunning: extraction?.status === "running",
    };
  }, [tick]);

  const dateLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);

  const timeLabel = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(now);

  const updatedLabel =
    snapshot.meta && typeof snapshot.meta.importedAt === "string"
      ? new Intl.DateTimeFormat("fr-FR", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(snapshot.meta.importedAt))
      : null;

  const quickLinks = [
    {
      href: "/schedule",
      title: "Emploi du temps",
      desc: "Voir et ajuster votre semaine",
      icon: Calendar,
      accent: "from-blue-500/10 to-blue-600/5 border-blue-200",
    },
    {
      href: "/exam-schedule",
      title: "Emploi des examens",
      desc: "Epreuves et revisions generees",
      icon: CalendarRange,
      accent: "from-amber-500/10 to-amber-600/5 border-amber-200",
    },
    {
      href: "/exams",
      title: "Examens",
      desc: "Periode et epreuves",
      icon: GraduationCap,
      accent: "from-rose-500/10 to-rose-600/5 border-rose-200",
    },
    {
      href: "/study-plan",
      title: "Plan d'etude",
      desc: "Objectifs et progression",
      icon: BookOpen,
      accent: "from-violet-500/10 to-violet-600/5 border-violet-200",
    },
    {
      href: "/upload",
      title: "Importer",
      desc: "Charger un nouvel emploi du temps",
      icon: Upload,
      accent: "from-emerald-500/10 to-emerald-600/5 border-emerald-200",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-secondary-600 mb-1">
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">
              Vue d&apos;ensemble
            </span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">
            Bonjour, {snapshot.displayName}
          </h1>
          <p className="text-slate-600 mt-1 max-w-xl">
            Retrouvez vos indicateurs et accedez rapidement aux sections de
            Study Planner.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm min-w-50">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Clock className="w-4 h-4" />
            <span className="capitalize">{dateLabel}</span>
          </div>
          <p className="text-2xl font-mono font-semibold text-slate-800 mt-1 tabular-nums">
            {timeLabel}
          </p>
        </div>
      </div>

      {snapshot.extractionRunning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3 text-amber-900">
          <Sparkles className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Extraction en cours</p>
            <p className="text-sm text-amber-800/90 mt-0.5">
              Restez sur la page Import jusqu&apos;a la fin du traitement pour
              mettre a jour votre planning.
            </p>
            <Link
              href="/upload"
              className="inline-flex items-center gap-1 text-sm font-semibold text-amber-950 mt-2 hover:underline"
            >
              Ouvrir l&apos;import
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Seances totales</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">
            {snapshot.eventCount}
          </p>
          {!snapshot.hasPlanning && (
            <p className="text-xs text-slate-500 mt-2">
              Importez un emploi du temps pour commencer.
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Cours</p>
          <p className="text-3xl font-bold text-blue-700 mt-1">
            {snapshot.courses}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Examens</p>
          <p className="text-3xl font-bold text-rose-700 mt-1">
            {snapshot.exams}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Revisions</p>
          <p className="text-3xl font-bold text-violet-700 mt-1">
            {snapshot.revisions}
          </p>
        </div>
      </div>

      {updatedLabel && (
        <p className="text-xs text-slate-500">
          Derniere mise a jour du planning enregistree :{" "}
          <span className="font-medium text-slate-700">{updatedLabel}</span>
        </p>
      )}

      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">
          Acces rapide
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {quickLinks.map(({ href, title, desc, icon: Icon, accent }) => (
            <Link
              key={href}
              href={href}
              className={`group rounded-2xl border bg-linear-to-br ${accent} p-5 shadow-sm hover:shadow-md transition-shadow`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-white/80 p-2.5 shadow-sm border border-white">
                    <Icon className="w-5 h-5 text-slate-700" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{title}</h3>
                    <p className="text-sm text-slate-600 mt-0.5">{desc}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
