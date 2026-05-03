"use client";
import { useState } from "react";
import { apiFetch } from "@/lib/apiClient";

export default function FileUpload({ subjectId, subjectName, onGenerated }) {
  const [file, setFile] = useState(null);
  const [questionCount, setQuestionCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [stepError, setStepError] = useState(null);
  const maxUploadMb = Number(process.env.NEXT_PUBLIC_QCM_UPLOAD_MAX_MB || 8);
  const maxUploadBytes = maxUploadMb * 1024 * 1024;

  function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes < 1024) return `${bytes} o`;
    const units = ["Ko", "Mo", "Go"];
    let size = bytes / 1024;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
  }

  function formatError(err) {
    const status = err?.status ? ` (HTTP ${err.status})` : "";
    const detail =
      err?.data?.details?.cause ||
      err?.data?.details?.body ||
      err?.data?.details?.message ||
      err?.data?.details ||
      err?.data?.message ||
      err?.message ||
      "Erreur inconnue";

    return `${detail}${status}`;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return setMessage("Sélectionnez un fichier");
    if (file.size > maxUploadBytes) {
      setMessage(
        `Le fichier est trop volumineux (${formatFileSize(file.size)}). Limite autorisée: ${maxUploadMb} Mo.`,
      );
      return;
    }

    setLoading(true);
    setMessage(null);
    setStepError(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("subjectName", String(subjectName || subjectId || "").trim());
      fd.append("questionCount", String(questionCount));

      let generated;
      try {
        generated = await apiFetch("/students/qcms/generate", {
          method: "POST",
          body: fd,
        });
      } catch (err) {
        if (err?.status === 413) {
          throw new Error(
            `Le fichier dépasse la limite autorisée par le backend (${maxUploadMb} Mo). Réduisez le PDF ou les images avant de réessayer.`,
          );
        }
        const code = err?.data?.code;
        if (code === "MISSING_GEMINI_API_KEY") {
          throw new Error("Clé Gemini absente côté backend");
        }
        if (code === "GEMINI_DISABLED") {
          throw new Error("Gemini est désactivé côté backend");
        }
        if (code === "GEMINI_REQUEST_FAILED") {
          throw new Error(
            err?.data?.details?.cause || "Erreur lors de l'appel à Gemini",
          );
        }
        throw err;
      }

      if (!generated || typeof generated !== "object") {
        throw new Error("Réponse IA invalide ou vide");
      }

      const effectiveSubjectId = String(
        generated.subjectId || subjectId || "",
      ).trim();
      if (!effectiveSubjectId) {
        throw new Error("Impossible de déterminer le sujet généré");
      }

      let created;
      try {
        created = await apiFetch(
          `/api/subjects/${encodeURIComponent(effectiveSubjectId)}/qcm`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(generated),
          },
        );
      } catch (err) {
        const code = err?.data?.code;
        if (code === "SUBJECT_NOT_FOUND") {
          throw new Error("Sujet introuvable côté backend");
        }
        if (code === "FORBIDDEN") {
          throw new Error("Ce sujet n'appartient pas à l'utilisateur connecté");
        }
        throw err;
      }

      setMessage("QCM généré et enregistré.");
      setFile(null);
      setQuestionCount(10);
      onGenerated?.(created, generated, effectiveSubjectId);
    } catch (err) {
      setStepError(formatError(err));
      setMessage(err?.message || "Échec de la génération QCM");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Fichier source</label>
        <input
          type="file"
          accept=".pdf,.txt,.docx,.png,.jpg,.jpeg,.webp"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm"
        />
        <p className="text-xs text-slate-600">
          Le backend analysera ce fichier avec l’IA pour générer le QCM. Limite
          conseillée: {maxUploadMb} Mo.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Nombre de questions</label>
          <input
            type="number"
            min={5}
            max={30}
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value) || 10)}
            className="input mt-1"
          />
        </div>

        <div className="flex items-end">
          <div className="text-xs text-slate-600 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 w-full">
            Sujet:{" "}
            <span className="font-medium text-slate-800">
              {subjectName || subjectId}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={loading || !file}
          className="btn-primary"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-white/50 border-t-white animate-spin" />
              Analyse en cours…
            </span>
          ) : (
            "Générer le QCM"
          )}
        </button>
        {message ? (
          <div className="text-sm text-slate-600">{message}</div>
        ) : null}
        {stepError ? (
          <div className="text-xs text-red-700">{stepError}</div>
        ) : null}
      </div>
    </form>
  );
}
