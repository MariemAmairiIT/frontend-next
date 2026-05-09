"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  GraduationCap,
  ListPlus,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import {
  loadPlanningFromStorage,
  loadPlanningMeta,
  savePlanningMeta,
  saveExamSmartSnapshot,
  savePlanningToStorage,
} from "@/lib/planningStorage";

const todayIso = () => new Date().toISOString().slice(0, 10);

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Map backend PlanningEventDto (day=start date, start/end times) to exam form rows. */
const extractedEventToExamRow = (ev) => {
  const dayOrDate = String(ev?.day || ev?.date || "").trim();
  const date = ISO_DATE_RE.test(dayOrDate) ? dayOrDate : todayIso();
  const startTime = String(ev?.startTime || ev?.start || "").trim() || "09:00";
  const endTime = String(ev?.endTime || ev?.end || "").trim() || "10:30";
  return {
    subject: String(ev?.subject || "").trim(),
    date,
    startTime,
    endTime,
  };
};

const addDaysIso = (isoDate, days) => {
  const base = isoDate ? new Date(`${isoDate}T00:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return todayIso();
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
};

const emptyExam = (subject = "") => ({
  subject,
  date: todayIso(),
  startTime: "09:00",
  endTime: "10:30",
});

const normalizeType = (value) => String(value || "").trim().toUpperCase();

const isCourseLike = (event) => {
  const type = normalizeType(event?.type);
  return !type || ["COURSE", "LECTURE", "LAB", "TUTORIAL", "CM", "TD", "TP"].includes(type);
};

const getEventDate = (event) => {
  const raw = String(event?.day || event?.date || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
};

const getEventType = (event) => {
  const type = normalizeType(event?.type);
  if (type === "EXAM") return "EXAM";
  if (type === "REVISION") return "REVISION";
  return "COURSE";
};

const typeClasses = {
  COURSE: "border-blue-200 bg-blue-50 text-blue-700",
  EXAM: "border-red-200 bg-red-50 text-red-700",
  REVISION: "border-purple-200 bg-purple-50 text-purple-700",
};

const typeLabel = {
  COURSE: "Cours",
  EXAM: "Examen",
  REVISION: "Revision",
};

function stripDiacritics(s) {
  try {
    return String(s || "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
  } catch {
    return String(s || "");
  }
}

function normalizeSubjectForMatch(s) {
  return stripDiacritics(String(s || "").toLowerCase())
    .replace(/&/g, " et ")
    .replace(/,/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function subjectTokens(s) {
  const norm = normalizeSubjectForMatch(s);
  const stop = new Set([
    "de", "des", "du", "la", "le", "les", "et", "pour", "l", "d", "au", "aux", "en", "a", "the", "and", "un", "une",
  ]);
  return norm
    .split(" ")
    .map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w))
    .filter((w) => w.length > 1 && !stop.has(w));
}

function tokenOverlapScore(a, b) {
  const ta = new Set(subjectTokens(a));
  const tb = new Set(subjectTokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) {
    if (tb.has(t)) inter += 1;
  }
  const union = ta.size + tb.size - inter;
  return union > 0 ? (inter / union) * 100 : 0;
}

/** Map OCR / extracted label to the closest subject from the imported timetable. */
function matchExtractedSubjectToCatalog(extracted, catalog) {
  const raw = String(extracted || "").trim();
  if (!raw || !catalog.length) return "";
  if (catalog.includes(raw)) return raw;
  const rl = raw.toLowerCase();
  const byCi = catalog.find((c) => c.toLowerCase() === rl);
  if (byCi) return byCi;

  const na = normalizeSubjectForMatch(raw);
  let best = "";
  let bestScore = 0;
  for (const c of catalog) {
    const nb = normalizeSubjectForMatch(c);
    let score = 0;
    if (na === nb) score = 100;
    else if (na.includes(nb) || nb.includes(na)) score = 90;
    else score = tokenOverlapScore(raw, c);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return bestScore >= 26 ? best : "";
}

export default function ExamsPage() {
  const router = useRouter();
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [planning, setPlanning] = useState(null);
  const [planningMeta, setPlanningMeta] = useState(null);
  const [examPeriod, setExamPeriod] = useState({
    startDate: todayIso(),
    endDate: addDaysIso(todayIso(), 6),
  });
  const [revisionPeriod, setRevisionPeriod] = useState({
    enabled: false,
    startDate: addDaysIso(todayIso(), -7),
    endDate: addDaysIso(todayIso(), -1),
  });
  const [exams, setExams] = useState([emptyExam()]);
  const [smartPlanning, setSmartPlanning] = useState([]);
  const [latestTimetable, setLatestTimetable] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Drag and drop state
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const init = async () => {
      let loadedPlanning = loadPlanningFromStorage();
      if (!loadedPlanning?.events?.length) {
        try {
          const remote = await apiFetch("/api/me/timetables/latest");
          const remoteEvents = remote?.events;
          if (Array.isArray(remoteEvents) && remoteEvents.length > 0) {
            loadedPlanning = {
              id: remote.id,
              timetableId: remote.id,
              timezone: remote.timezone || "Europe/Paris",
              warnings: remote.warnings || [],
              events: remoteEvents,
              sourceFileName: remote.sourceFileName,
            };
            savePlanningToStorage(loadedPlanning);
            const meta = loadPlanningMeta() || {};
            savePlanningMeta({ ...meta, timetableId: remote.id });
          }
        } catch {
          // not authenticated or no timetable
        }
      }

      setPlanning(loadedPlanning);
      setPlanningMeta(loadPlanningMeta());
      setStorageLoaded(true);

      try {
        const savedExams = localStorage.getItem("exams_draft");
        if (savedExams) {
          setExams(JSON.parse(savedExams));
        }
      } catch (e) {
        console.warn("Failed to load exams draft", e);
      }
    };

    init();
  }, []);

  const subjects = useMemo(() => {
    const events = Array.isArray(planning?.events) ? planning.events : [];
    const names = events
      .filter(isCourseLike)
      .map((event) => String(event?.subject || "").trim())
      .filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "fr"));
  }, [planning]);

  useEffect(() => {
    if (!subjects.length) return;
    setExams((current) =>
      current.map((exam) => {
        if (exam.subject && subjects.includes(exam.subject)) return exam;
        const matched = matchExtractedSubjectToCatalog(exam.subject, subjects);
        if (matched) return { ...exam, subject: matched };
        return { ...exam, subject: exam.subject || subjects[0] };
      }),
    );
  }, [subjects]);

  const timetableId =
    latestTimetable?.id ||
    latestTimetable?.timetableId ||
    planningMeta?.timetableId ||
    planning?.id ||
    planning?.timetableId ||
    null;

  const groupedSmartPlanning = useMemo(() => {
    const groups = new Map();
    for (const event of smartPlanning) {
      const key = getEventDate(event) || String(event?.day || "Sans date");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(event);
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => String(a).localeCompare(String(b)))
      .map(([date, events]) => ({
        date,
        events: events.sort((a, b) => String(a?.start || "").localeCompare(String(b?.start || ""))),
      }));
  }, [smartPlanning]);

  const updateExam = (index, patch) => {
    setExams((current) => {
      const next = current.map((exam, i) => (i === index ? { ...exam, ...patch } : exam));
      localStorage.setItem("exams_draft", JSON.stringify(next));
      return next;
    });
  };

  const addExam = () => {
    setExams((current) => {
      const next = [...current, emptyExam(subjects[0] || "")];
      localStorage.setItem("exams_draft", JSON.stringify(next));
      return next;
    });
  };

  const removeExam = (index) => {
    setExams((current) => {
      const next = current.filter((_, i) => i !== index);
      localStorage.setItem("exams_draft", JSON.stringify(next));
      return next;
    });
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleExtractExams = async () => {
    if (!file) return;
    setError(null);
    setProgress(0);
    setIsProcessing(true);

    const body = new FormData();
    body.set("file", file);

    let timer;
    try {
      let currentProgress = 5;
      setProgress(currentProgress);
      timer = setInterval(() => {
        currentProgress = Math.min(95, currentProgress + 3);
        setProgress(currentProgress);
      }, 250);

      // We call the backend directly or via proxy to extract exams
      const data = await apiFetch("/api/exams/extract", {
        method: "POST",
        body,
      });

      if (!data || typeof data !== "object" || !Array.isArray(data.events)) {
        throw new Error("Réponse invalide: la liste des événements (events) est manquante.");
      }

      const catalog = subjects;
      const examRowsRaw = data.events.map(extractedEventToExamRow);
      const examRows = examRowsRaw.map((row) => {
        const m = matchExtractedSubjectToCatalog(row.subject, catalog);
        return { ...row, subject: m || row.subject };
      });

      const dates = examRows.map((e) => e.date).filter((d) => ISO_DATE_RE.test(d)).sort();
      let periodUpdate = null;
      if (dates.length) {
        periodUpdate = { startDate: dates[0], endDate: dates[dates.length - 1] };
        setExamPeriod(periodUpdate);
      }

      setExams(examRows);
      localStorage.setItem("exams_draft", JSON.stringify(examRows));

      const unmatched = examRows.filter((e) => !catalog.includes(e.subject));
      if (!catalog.length) {
        setError(null);
        setStatus(
          `${examRows.length} examen(s) importé(s). Importez l'emploi du temps pour associer les matières et enregistrer en base.`,
        );
      } else if (unmatched.length) {
        setStatus(`${examRows.length} examen(s) importé(s).`);
        setError(
          `Matière(s) à vérifier (sélection manuelle) : ${unmatched.map((u) => u.subject || "(vide)").join(" · ")}`,
        );
      } else {
        setError(null);
      }

      if (catalog.length && periodUpdate && unmatched.length === 0) {
        try {
          setError(null);
          await apiFetch("/api/exam-period", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(periodUpdate),
          });
          await apiFetch("/api/exams/replace-all", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(examRows),
          });
          setStatus(
            `${examRows.length} examen(s) importé(s) et enregistré(s) en base. Période d'examens : ${periodUpdate.startDate} → ${periodUpdate.endDate}.`,
          );
        } catch (persistErr) {
          setStatus(`${examRows.length} examen(s) importé(s) (affichage local).`);
          setError(
            persistErr?.message ||
              "Import réussi mais enregistrement MongoDB échoué (session ou serveur).",
          );
        }
      } else if (catalog.length && periodUpdate && unmatched.length) {
        setStatus(
          `${examRows.length} examen(s) importé(s). Corrigez les matières puis cliquez sur « Générer le planning smart » pour enregistrer.`,
        );
      } else {
        setStatus((prev) => prev || `${examRows.length} examen(s) importé(s) avec succès.`);
      }

      setProgress(100);
      setFile(null);
    } catch (e) {
      setError(e?.message || "Erreur lors de l'extraction des examens.");
    } finally {
      setIsProcessing(false);
      if (timer) clearInterval(timer);
    }
  };

  const validate = () => {
    if (!examPeriod.startDate || !examPeriod.endDate) {
      return "Choisissez le debut et la fin de la periode d'examens.";
    }
    if (examPeriod.endDate < examPeriod.startDate) {
      return "La fin de la periode d'examens doit etre apres le debut.";
    }
    if (!subjects.length) {
      return "Importez d'abord un emploi du temps pour recuperer les matieres.";
    }

    for (const [index, exam] of exams.entries()) {
      if (!exam.subject || !exam.date || !exam.startTime || !exam.endTime) {
        return `Completez toutes les informations de l'examen ${index + 1}.`;
      }
      if (!subjects.includes(exam.subject)) {
        return `La matiere "${exam.subject}" doit venir de l'emploi du temps importe.`;
      }
      if (exam.date < examPeriod.startDate || exam.date > examPeriod.endDate) {
        return `L'examen ${index + 1} doit etre dans la periode d'examens.`;
      }
      if (exam.endTime <= exam.startTime) {
        return `L'heure de fin de l'examen ${index + 1} doit etre apres le debut.`;
      }
    }

    if (revisionPeriod.enabled) {
      if (!revisionPeriod.startDate || !revisionPeriod.endDate) {
        return "Completez la periode de revision ou desactivez-la.";
      }
      if (revisionPeriod.endDate < revisionPeriod.startDate) {
        return "La fin de la periode de revision doit etre apres le debut.";
      }
      if (revisionPeriod.endDate >= examPeriod.startDate) {
        return "La periode de revision doit se terminer avant les examens.";
      }
    }

    return null;
  };

  const fetchLatestTimetable = async () => {
    const data = await apiFetch("/api/me/timetables/latest");
    if (!data || typeof data !== "object") {
      throw new Error("Aucun emploi du temps backend n'a ete trouve.");
    }
    setLatestTimetable(data);
    return data;
  };

  const saveConfiguration = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setStatus(null);
      return false;
    }

    setIsSaving(true);
    setError(null);
    setStatus("Enregistrement de la configuration examens...");

    try {
      await apiFetch("/api/exam-period", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(examPeriod),
      });

      await apiFetch("/api/exams/replace-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exams),
      });

      await apiFetch("/api/revision-period", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          revisionPeriod.enabled
            ? revisionPeriod
            : { enabled: false, startDate: null, endDate: null },
        ),
      });

      setStatus("Configuration enregistree. Le planning peut etre genere.");
      return true;
    } catch (saveError) {
      setError(saveError?.message || "Erreur lors de l'enregistrement.");
      setStatus(null);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const generateSmartPlanning = async () => {
    const saved = await saveConfiguration();
    if (!saved) return;

    setIsGenerating(true);
    setError(null);
    setStatus("Generation du planning intelligent...");

    try {
      const timetable = timetableId ? latestTimetable : await fetchLatestTimetable();
      const id = timetableId || timetable?.id || timetable?.timetableId;

      if (!id) {
        throw new Error("Impossible de trouver l'identifiant du dernier emploi du temps.");
      }

      const data = await apiFetch(`/api/planning/smart?timetableId=${encodeURIComponent(id)}`);
      const events = Array.isArray(data?.events) ? data.events : [];
      setSmartPlanning(events);
      setStatus(`${events.length} evenement(s) generes. Ouverture de Mon emploi des examens…`);

      saveExamSmartSnapshot({
        events,
        examPeriod: { ...examPeriod },
        revisionPeriod: { ...revisionPeriod },
        exams: exams.map((e) => ({ ...e })),
        timetableId: id,
      });
      router.push("/exam-schedule");
    } catch (generateError) {
      setError(generateError?.message || "Erreur lors de la generation du planning.");
      setStatus(null);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-100 text-primary-800">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Gestion des examens</h2>
              <p className="mt-1 text-slate-500">
                Configurez une periode flexible, les examens, puis laissez le backend generer le planning.
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={generateSmartPlanning}
          disabled={isSaving || isGenerating || !storageLoaded}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Generer le planning smart
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {status && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{status}</p>
        </div>
      )}

      {/* Drag & Drop Upload Section */}
      {!isProcessing ? (
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500 to-secondary-500"></div>
          
          <div 
            className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 ${
              dragActive ? 'border-secondary-400 bg-secondary-50 scale-[1.01]' : 'border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-secondary-600" />
                </div>
                <p className="text-lg font-semibold text-slate-800">{file.name}</p>
                <p className="text-sm text-slate-500 mb-6">{(file.size / 1024).toFixed(1)} Ko</p>
                
                <div className="flex gap-4">
                  <button onClick={() => setFile(null)} className="px-5 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-colors">
                    Retirer
                  </button>
                  <button onClick={handleExtractExams} className="px-6 py-2 bg-primary-800 text-white font-medium rounded-xl hover:bg-primary-900 transition-all shadow-md hover:shadow-lg flex items-center gap-2">
                    Analyser les examens <Sparkles className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center pointer-events-none">
                <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-6">
                  <UploadCloud className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-xl font-semibold text-slate-700 mb-2">Importer une photo des examens</p>
                <p className="text-slate-500 mb-8">PDF, PNG, JPEG</p>
                <div className="pointer-events-auto">
                  <label className="cursor-pointer px-6 py-3 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl shadow-sm hover:bg-slate-50 hover:shadow transition-all">
                    Parcourir les fichiers
                    <input type="file" className="hidden" onChange={(e) => {
                      if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
                    }} />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-3xl border border-slate-100 shadow-sm text-center">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <svg className="animate-spin w-full h-full text-slate-100" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
              <path className="opacity-75 text-secondary-600" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-secondary-600 text-xl font-bold">
              {progress}%
            </div>
          </div>
          
          <h3 className="text-2xl font-bold text-slate-800 mb-2">L’IA analyse vos examens</h3>
          <p className="text-slate-500 mb-8">Extraction des dates, heures et matières des examens...</p>
          
          <div className="w-full max-w-md mx-auto bg-slate-100 h-3 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-secondary-500 to-primary-500 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          
          <div className="mt-8 space-y-3 max-w-xs mx-auto text-left">
            <div className={`flex items-center gap-3 transition-opacity ${progress > 20 ? 'opacity-100' : 'opacity-40'}`}>
              <CheckCircle className="w-5 h-5 text-green-500" /> <span className="text-sm font-medium">Lecture du document</span>
            </div>
            <div className={`flex items-center gap-3 transition-opacity ${progress > 50 ? 'opacity-100' : 'opacity-40'}`}>
              <CheckCircle className="w-5 h-5 text-green-500" /> <span className="text-sm font-medium">Identification des épreuves</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary-800" />
              <h3 className="text-lg font-bold text-slate-900">Periode d&apos;examens</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">Date debut</span>
                <input
                  type="date"
                  id="examPeriodStartDate"
                  name="examPeriodStartDate"
                  value={examPeriod.startDate || ""}
                  onChange={(event) =>
                    setExamPeriod((current) => ({ ...current, startDate: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-secondary-300"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">Date fin</span>
                <input
                  type="date"
                  id="examPeriodEndDate"
                  name="examPeriodEndDate"
                  value={examPeriod.endDate || ""}
                  onChange={(event) =>
                    setExamPeriod((current) => ({ ...current, endDate: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-secondary-300"
                />
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ListPlus className="h-5 w-5 text-primary-800" />
                <h3 className="text-lg font-bold text-slate-900">Examens</h3>
              </div>
              <button
                type="button"
                onClick={addExam}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
                Ajouter
              </button>
            </div>

            {!subjects.length && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Aucune matiere trouvee. Importez l&apos;emploi du temps pour alimenter la liste des sujets.
              </div>
            )}

            <div className="space-y-3">
              {exams.map((exam, index) => (
                <div key={index} className="grid gap-3 rounded-lg border border-slate-200 p-3 lg:grid-cols-[1.2fr_1fr_0.8fr_0.8fr_auto]">
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Matiere</span>
                    <select
                      id={`examSubject-${index}`}
                      name={`examSubject-${index}`}
                      value={exam.subject || ""}
                      onChange={(event) => updateExam(index, { subject: event.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-secondary-300"
                    >
                      <option value="">Choisir</option>
                      {subjects.map((subject) => (
                        <option key={subject} value={subject}>
                          {subject}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</span>
                    <input
                      type="date"
                      id={`examDate-${index}`}
                      name={`examDate-${index}`}
                      value={exam.date || ""}
                      min={examPeriod.startDate}
                      max={examPeriod.endDate}
                      onChange={(event) => updateExam(index, { date: event.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-secondary-300"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Debut</span>
                    <input
                      type="time"
                      id={`examStartTime-${index}`}
                      name={`examStartTime-${index}`}
                      value={exam.startTime || ""}
                      onChange={(event) => updateExam(index, { startTime: event.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-secondary-300"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fin</span>
                    <input
                      type="time"
                      id={`examEndTime-${index}`}
                      name={`examEndTime-${index}`}
                      value={exam.endTime || ""}
                      onChange={(event) => updateExam(index, { endTime: event.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-secondary-300"
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => removeExam(index)}
                      disabled={exams.length === 1}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Supprimer l'examen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary-800" />
                <h3 className="text-lg font-bold text-slate-900">Periode de revision</h3>
              </div>
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  id="revisionPeriodEnabled"
                  name="revisionPeriodEnabled"
                  checked={!!revisionPeriod.enabled}
                  onChange={(event) =>
                    setRevisionPeriod((current) => ({ ...current, enabled: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                Activee
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">Date debut</span>
                <input
                  type="date"
                  id="revisionPeriodStartDate"
                  name="revisionPeriodStartDate"
                  value={revisionPeriod.startDate || ""}
                  disabled={!revisionPeriod.enabled}
                  onChange={(event) =>
                    setRevisionPeriod((current) => ({ ...current, startDate: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-secondary-300 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">Date fin</span>
                <input
                  type="date"
                  id="revisionPeriodEndDate"
                  name="revisionPeriodEndDate"
                  value={revisionPeriod.endDate || ""}
                  disabled={!revisionPeriod.enabled}
                  max={addDaysIso(examPeriod.startDate, -1)}
                  onChange={(event) =>
                    setRevisionPeriod((current) => ({ ...current, endDate: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-secondary-300 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </label>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900">Matieres detectees</h3>
            <p className="mt-1 text-sm text-slate-500">
              Les examens utilisent uniquement les sujets de l&apos;emploi du temps importe.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {subjects.length ? (
                subjects.map((subject) => (
                  <span key={subject} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    {subject}
                  </span>
                ))
              ) : (
                <button
                  type="button"
                  onClick={() => router.push("/upload")}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Eye className="h-4 w-4" />
                  Importer un planning
                </button>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900">Apercu smart</h3>
            <p className="mt-1 text-sm text-slate-500">
              Pendant les examens, les cours disparaissent et seuls examens/revisions restent.
            </p>
            <div className="mt-4 space-y-4">
              {!groupedSmartPlanning.length && (
                <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                  Generez le planning pour voir le resultat retourne par le backend.
                </p>
              )}
              {groupedSmartPlanning.map((group) => (
                <div key={group.date} className="rounded-lg border border-slate-200">
                  <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800">
                    {group.date}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {group.events.map((event, index) => {
                      const type = getEventType(event);
                      return (
                        <div key={`${group.date}-${event?.id || index}`} className="p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{event?.subject || "Sans titre"}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {event?.start || "--:--"} - {event?.end || "--:--"}
                                {event?.room ? ` · ${event.room}` : ""}
                              </p>
                            </div>
                            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${typeClasses[type]}`}>
                              {typeLabel[type]}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
