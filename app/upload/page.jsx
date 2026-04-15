'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { UploadCloud, FileText, CheckCircle, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  clearExtractionState,
  clearPlanningStorage,
  DAY_UI_TO_BACKEND,
  loadExtractionState,
  loadPlanningFromStorage,
  loadPlanningMeta,
  minutesToTime,
  saveExtractionState,
  timeToMinutes,
  TYPE_LABEL_FR,
  savePlanningMeta,
  savePlanningToStorage,
} from '@/lib/planningStorage';
import { apiFetch } from '@/lib/apiClient';
import { getCurrentUser } from '@/lib/studentAuth';

const UploadSchedule = () => {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const router = useRouter();

  // Avoid hydration mismatch: server render can't read localStorage, client can.
  // Start deterministically, then load from storage in an effect.
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [existingPlanning, setExistingPlanning] = useState(null);
  const [existingMeta, setExistingMeta] = useState(null);
  const hasExistingPlanning = Array.isArray(existingPlanning?.events) && existingPlanning.events.length > 0;

  const existingSubjects = useMemo(() => {
    const events = Array.isArray(existingPlanning?.events) ? existingPlanning.events : [];
    const subjects = events
      .map((ev) => (typeof ev?.subject === 'string' ? ev.subject.trim() : ''))
      .filter(Boolean);
    return Array.from(new Set(subjects)).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [existingPlanning]);

  const extractedPreview = useMemo(() => {
    const planning = existingPlanning;
    const events = Array.isArray(planning?.events) ? planning.events : [];

    const dayLabelBackend = {
      MONDAY: 'Lundi',
      TUESDAY: 'Mardi',
      WEDNESDAY: 'Mercredi',
      THURSDAY: 'Jeudi',
      FRIDAY: 'Vendredi',
      SATURDAY: 'Samedi',
      SUNDAY: 'Dimanche',
    };

    const normalized = events
      .map((ev) => {
        const dayKey = String(ev?.day || '').toUpperCase();
        const day = dayLabelBackend[dayKey] || dayKey || '—';
        const start = typeof ev?.start === 'string' ? ev.start : '';
        const end = typeof ev?.end === 'string' ? ev.end : '';
        const subject = typeof ev?.subject === 'string' ? ev.subject : '';
        const room = typeof ev?.room === 'string' ? ev.room : '';
        const typeKey = String(ev?.type || 'LECTURE').toUpperCase();
        const type = TYPE_LABEL_FR[typeKey] || typeKey;
        return { dayKey, day, start, end, subject, room, type, typeKey };
      })
      .filter((x) => x.subject || x.start || x.end);

    normalized.sort((a, b) => {
      const aDay = a.dayKey.localeCompare(b.dayKey);
      if (aDay !== 0) return aDay;
      return String(a.start).localeCompare(String(b.start));
    });

    return {
      timezone: planning?.timezone || 'Europe/Paris',
      events: normalized,
    };
  }, [existingPlanning]);

  useEffect(() => {
    setError(null);
  }, []);

  useEffect(() => {
    // If the user navigated away mid-extraction, the File object cannot be restored.
    // We surface a clear message and reset the stale flag.
    const extraction = loadExtractionState();
    if (extraction?.status === 'running') {
      const fileName = typeof extraction.fileName === 'string' && extraction.fileName.trim() !== '' ? extraction.fileName : null;
      setError(
        fileName
          ? `Extraction interrompue: le fichier "${fileName}" ne peut pas être conservé si vous quittez la page. Veuillez relancer l’import.`
          : 'Extraction interrompue: le fichier ne peut pas être conservé si vous quittez la page. Veuillez relancer l’import.',
      );
      clearExtractionState();
    }
  }, []);

  useEffect(() => {
    if (!isProcessing) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isProcessing]);

  useEffect(() => {
    const refresh = () => {
      setExistingPlanning(loadPlanningFromStorage());
      setExistingMeta(loadPlanningMeta());
      setStorageLoaded(true);
    };

    const onFocus = () => refresh();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    refresh();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

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

  const handleExtractSchedule = async () => {
    if (!file) return;
    setError(null);
    setProgress(0);
    setIsProcessing(true);

    saveExtractionState({
      status: 'running',
      fileName: file?.name || null,
      startedAt: Date.now(),
    });

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';

    const body = new FormData();
    body.set('file', file);

    let timer;
    try {
      let currentProgress = 5;
      setProgress(currentProgress);
      timer = setInterval(() => {
        currentProgress = Math.min(95, currentProgress + 3);
        setProgress(currentProgress);
      }, 250);

      let data = null;
      try {
        data = await apiFetch(`/api/planning/extract?timezone=${encodeURIComponent(timezone)}`, {
          method: 'POST',
          body,
        });
      } catch (err) {
        const upstreamStatus = Number(err?.status) || null;
        const errData = err?.data;
        // Helpful debug for backend/Gemini errors (often forwarded in details.body)
        // eslint-disable-next-line no-console
        console.log('Gemini error details:', errData?.details?.body);

        const upstreamMessage =
          (typeof errData?.message === 'string' && errData.message) ||
          (typeof errData?.details?.body === 'string' && errData.details.body) ||
          (typeof errData?.payload?.message === 'string' && errData.payload.message) ||
          (typeof errData?.payload?.error?.message === 'string' && errData.payload.error.message) ||
          (typeof errData?.payload?.error?.status === 'string' && errData.payload.error.status) ||
          (typeof errData?.payload?.error === 'string' && errData.payload.error) ||
          (typeof errData?.payload === 'string' && errData.payload) ||
          (typeof err?.message === 'string' && err.message) ||
          null;

        if (upstreamStatus === 401) {
          const detail = upstreamMessage ? ` Détail: ${upstreamMessage}` : '';
          throw new Error(`Non autorisé (401).${detail} Vérifiez l’authentification du backend (token/clé API) ou la configuration côté Gemini.`);
        }

        throw new Error(upstreamMessage || 'Erreur lors de l’extraction du planning.');
      }

      if (!data || typeof data !== 'object' || !Array.isArray(data.events)) {
        throw new Error('Réponse backend invalide: la liste des événements (events) est manquante.');
      }

      savePlanningToStorage(data);

      // Persist in backend (best effort) so the planning survives across devices/sessions.
      try {
        const dayFrToBackend = {
          LUNDI: 'MONDAY',
          MARDI: 'TUESDAY',
          MERCREDI: 'WEDNESDAY',
          JEUDI: 'THURSDAY',
          VENDREDI: 'FRIDAY',
          SAMEDI: 'SATURDAY',
          DIMANCHE: 'SUNDAY',
        };

        const normalizeDayToBackend = (day) => {
          const raw = String(day ?? '').trim();
          if (!raw) return null;

          if (DAY_UI_TO_BACKEND[raw]) return DAY_UI_TO_BACKEND[raw];

          const upper = raw.toUpperCase();
          if (dayFrToBackend[upper]) return dayFrToBackend[upper];

          // Assume backend already
          return upper;
        };

        const normalizeTimeString = (value) => {
          const raw = String(value ?? '').trim();
          if (!raw) return null;
          const mins = timeToMinutes(raw);
          if (typeof mins === 'number') return minutesToTime(mins);
          return null;
        };

        const normalizeEventForSave = (ev) => {
          const day = normalizeDayToBackend(ev?.day);

          const startMin =
            typeof ev?.startMin === 'number'
              ? ev.startMin
              : (typeof ev?.start === 'string' ? timeToMinutes(ev.start) : null);
          const endMin =
            typeof ev?.endMin === 'number'
              ? ev.endMin
              : (typeof ev?.end === 'string' ? timeToMinutes(ev.end) : null);

          const start =
            typeof startMin === 'number'
              ? minutesToTime(startMin)
              : normalizeTimeString(ev?.start);
          const end =
            typeof endMin === 'number'
              ? minutesToTime(endMin)
              : normalizeTimeString(ev?.end);

          const durationMinutes =
            typeof startMin === 'number' && typeof endMin === 'number'
              ? Math.max(0, endMin - startMin)
              : (typeof ev?.durationMinutes === 'number' ? ev.durationMinutes : null);

          return {
            day,
            start,
            end,
            subject: ev?.subject ?? null,
            room: ev?.room ?? null,
            type: ev?.type ?? null,
            durationMinutes,
          };
        };

        const currentUser = getCurrentUser();
        const ownerEmail =
          typeof currentUser?.email === 'string' && currentUser.email.trim() !== ''
            ? currentUser.email.trim().toLowerCase()
            : null;

        await apiFetch('/api/planning/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timezone: data.timezone,
            sourceFileName: file?.name ?? null,
            ownerEmail,
            events: data.events.map(normalizeEventForSave),
          }),
        });
      } catch (persistErr) {
        // eslint-disable-next-line no-console
        console.warn('Backend planning save error:', persistErr);
      }

      const nextMeta = {
        fileName: file?.name || null,
        importedAt: new Date().toISOString(),
      };
      savePlanningMeta(nextMeta);
      setExistingPlanning(data);
      setExistingMeta(nextMeta);
      setProgress(100);
      clearExtractionState();
      router.push('/schedule');
    } catch (e) {
      setError(e?.message || 'Erreur inconnue');
      setIsProcessing(false);
      setProgress(0);
      clearExtractionState();
    } finally {
      if (timer) clearInterval(timer);
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center mb-10 mt-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 text-primary-700 mb-4">
          <Sparkles className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-3">Importer votre emploi du temps</h2>
        <p className="text-slate-500 text-lg max-w-xl mx-auto">
          Notre IA analysera votre planning, identifiera vos cours et générera automatiquement un plan d’étude et de révision optimisé.
        </p>
      </div>

      {storageLoaded && hasExistingPlanning && !isProcessing && (
        <div className="mb-6 space-y-3">
          <div className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-800">Un planning est déjà importé.</p>
              <p className="text-sm text-slate-500">
                {typeof existingMeta?.fileName === 'string' && existingMeta.fileName.trim() !== ''
                  ? `Dernier fichier: ${existingMeta.fileName}`
                  : 'Vous pouvez l’ouvrir ou en importer un nouveau.'}
              </p>
             
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/schedule')}
                className="px-4 py-2 bg-primary-800 text-white text-sm font-medium rounded-xl hover:bg-primary-900 transition-colors"
              >
                Voir l’emploi du temps
              </button>
              <button
                onClick={() => {
                  clearPlanningStorage();
                  setExistingPlanning(null);
                  setExistingMeta(null);
                }}
                className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-100 rounded-xl transition-colors"
              >
                Réinitialiser
              </button>
            </div>
          </div>

          
        </div>
      )}

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
                  <button onClick={handleExtractSchedule} className="px-6 py-2 bg-primary-800 text-white font-medium rounded-xl hover:bg-primary-900 transition-all shadow-md hover:shadow-lg flex items-center gap-2">
                    Analyser le plan <Sparkles className="w-4 h-4" />
                  </button>
                </div>

                {error && (
                  <p className="mt-4 text-sm text-red-600 text-center max-w-lg">
                    {error}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center pointer-events-none">
                <div className="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center mb-6">
                  <UploadCloud className="w-10 h-10 text-slate-400" />
                </div>
                <p className="text-xl font-semibold text-slate-700 mb-2">Glissez‑déposez votre emploi du temps ici</p>
                <p className="text-slate-500 mb-8">PDF, PNG, JPEG ou Excel</p>
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
          
          <h3 className="text-2xl font-bold text-slate-800 mb-2">L’IA analyse votre emploi du temps</h3>
          <p className="text-slate-500 mb-8">Identification des heures de cours, analyse des matières et application de la répétition espacée…</p>
          
          <div className="w-full max-w-md mx-auto bg-slate-100 h-3 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-secondary-500 to-primary-500 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          
          <div className="mt-8 space-y-3 max-w-xs mx-auto text-left">
            <div className={`flex items-center gap-3 transition-opacity ${progress > 20 ? 'opacity-100' : 'opacity-40'}`}>
              <CheckCircle className="w-5 h-5 text-green-500" /> <span className="text-sm font-medium">Extraction du texte du fichier</span>
            </div>
            <div className={`flex items-center gap-3 transition-opacity ${progress > 50 ? 'opacity-100' : 'opacity-40'}`}>
              <CheckCircle className="w-5 h-5 text-green-500" /> <span className="text-sm font-medium">Cartographie des créneaux de cours</span>
            </div>
            <div className={`flex items-center gap-3 transition-opacity ${progress > 80 ? 'opacity-100' : 'opacity-40'}`}>
              <CheckCircle className="w-5 h-5 text-green-500" /> <span className="text-sm font-medium">Génération du plan intelligent</span>
            </div>
          </div>

          {error && (
            <p className="mt-6 text-sm text-red-600 text-center max-w-lg mx-auto">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default UploadSchedule;

