"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Loader from "@/components/Loader";
import { apiFetch } from "@/lib/apiClient";

export default function AllQcmsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const subjects = await apiFetch("/api/subjects");
      const list = Array.isArray(subjects) ? subjects : [];

      // Fetch qcms for each subject in parallel
      const promises = list.map(async (s) => {
        try {
          const qcms = await apiFetch(
            `/api/subjects/${encodeURIComponent(s.id)}/qcm`,
          );
          return (Array.isArray(qcms) ? qcms : []).map((q) => ({
            ...q,
            subjectId: s.id,
            subjectName: s.name,
          }));
        } catch (err) {
          return [];
        }
      });

      const nested = await Promise.all(promises);
      const flat = nested.flat();
      flat.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setItems(flat);
    } catch (err) {
      setError(err?.message ? String(err.message) : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm text-slate-600">Mes QCM</div>
          <h1 className="text-2xl font-bold">QCM générés</h1>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-outline" onClick={loadAll}>
            Actualiser
          </button>
          <Link href="/subjects" className="btn-outline">
            Sujets
          </Link>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader label="Chargement des QCM…" />
          </div>
        ) : error ? (
          <div className="text-sm text-red-700">{error}</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-slate-600">Aucun QCM trouvé.</div>
        ) : (
          <div className="space-y-3">
            {items.map((q) => (
              <div
                key={`${q.subjectId}:${q.id}`}
                className="rounded-xl border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      {q.title || `QCM ${q.id}`}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      {q.questionCount ??
                        (Array.isArray(q.questions)
                          ? q.questions.length
                          : 0)}{" "}
                      question(s) · {q.subjectName}
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
                    href={`/subjects/${q.subjectId}/qcm/${q.id}`}
                    className="btn-primary"
                  >
                    Ouvrir
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
