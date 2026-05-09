"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Loader from "@/components/Loader";
import { apiFetch } from "@/lib/apiClient";
import {
  loadArchivedSubjects,
  removeArchivedSubject,
  upsertArchivedSubject,
} from "@/lib/archivedSubjectsStore";

export default function ArchivedSubjectsPage() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setSubjects(loadArchivedSubjects());
    } catch (err) {
      setError(err?.message ? String(err.message) : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleArchive(subject, archived) {
    const subjectId = String(subject?.id || "");
    if (!subjectId) return;

    setActionError(null);
    try {
      const updated = await apiFetch(
        `/api/subjects/${encodeURIComponent(subjectId)}/archive`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived }),
        },
      );

      if (updated?.archived) {
        upsertArchivedSubject(updated);
      } else {
        removeArchivedSubject(subjectId);
      }
      await load();
    } catch (err) {
      setActionError(err?.message ? String(err.message) : String(err));
    }
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
            <span className="text-slate-500">Archivés</span>
          </div>
          <h1 className="text-2xl font-bold">Sujets archivés</h1>
          <p className="text-sm text-slate-600">
            Dossiers archivés — vous pouvez les restaurer ici.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/subjects" className="btn-outline">
            Retour
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center">
          <Loader label="Chargement des archivés…" />
        </div>
      ) : error ? (
        <div className="rounded-xl border bg-white p-6 text-sm text-red-700">
          {error}
        </div>
      ) : subjects.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-center text-sm text-slate-600">
          Aucun dossier archivé.
        </div>
      ) : (
        <div className="space-y-3">
          {actionError ? (
            <div className="rounded-xl border bg-white p-4 text-sm text-red-700">
              {actionError}
            </div>
          ) : null}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {subjects.map((subject) => (
              <div
                key={subject.id}
                className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-yellow-950">
                      {subject.name}
                    </div>
                    <div className="mt-1 text-xs text-yellow-800">
                      {subject.slug || subject.id}
                    </div>
                  </div>
                  <div className="rounded-full border border-yellow-200 bg-white px-2 py-0.5 text-xs font-medium text-yellow-800">
                    Archivé
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <div className="text-xs text-yellow-800">
                    Sujet archivé, visible uniquement ici.
                  </div>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => toggleArchive(subject, false)}
                  >
                    Restaurer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
