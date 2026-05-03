"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Loader from "@/components/Loader";
import { apiFetch } from "@/lib/apiClient";
import { getCurrentUser } from "@/lib/studentAuth";

export default function QCMGeneratorPage() {
  const params = useParams();
  const subjectId = String(params?.subjectId || "");
  const [qcms, setQcms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadQcms() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(
        `/api/subjects/${encodeURIComponent(subjectId)}/qcm`,
      );
      setQcms(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message ? String(err.message) : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!subjectId) return;
    loadQcms();
  }, [subjectId]);

  async function deleteQcm(qcmId) {
    const user = getCurrentUser();
    if (user?.role !== "admin") {
      alert("Action réservée à l'administrateur.");
      return;
    }
    const ok = window.confirm("Supprimer ce QCM ?");
    if (!ok) return;
    try {
      await apiFetch(`/api/qcms/${qcmId}`, { method: "DELETE" });
    } catch (err) {
      alert(err?.message ? String(err.message) : "Suppression impossible");
      return;
    }
    await loadQcms();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm text-slate-600">
            <Link
              href="/subjects"
              className="text-secondary-700 hover:underline"
            >
              Sujets
            </Link>
            <span className="mx-2">/</span>
            <span className="text-slate-500">QCM</span>
          </div>
          <h1 className="text-2xl font-bold">QCM</h1>
          <p className="text-sm text-slate-600">
            Sujet: <span className="font-mono text-slate-700">{subjectId}</span>
          </p>
        </div>
        <Link href={`/subjects/${subjectId}/upload`} className="btn-outline">
          Générer un QCM
        </Link>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Mes QCM</h2>
          <button type="button" className="btn-outline" onClick={loadQcms}>
            Actualiser
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader label="Chargement des QCM…" />
            </div>
          ) : error ? (
            <div className="text-sm text-red-700">{error}</div>
          ) : qcms.length === 0 ? (
            <div className="text-sm text-slate-600">
              Aucun QCM généré pour ce sujet.
            </div>
          ) : (
            qcms.map((q) => (
              <div
                key={q.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      {q.title || `QCM ${q.id}`}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      {(q.questions?.length ?? 0) || 0} question(s)
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">
                    {q.createdAt
                      ? new Date(q.createdAt).toLocaleString("fr-FR")
                      : ""}
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/subjects/${subjectId}/qcm/${q.id}`}
                    className="btn-primary"
                  >
                    Ouvrir
                  </Link>
                  {getCurrentUser()?.role === "admin" ? (
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => deleteQcm(q.id)}
                    >
                      Supprimer
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
