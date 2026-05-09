"use client";
import { useEffect, useState } from "react";
import SubjectFolder from "@/components/SubjectFolder";
import Loader from "@/components/Loader";
import { apiFetch } from "@/lib/apiClient";
import Link from "next/link";
import {
  removeArchivedSubject,
  upsertArchivedSubject,
} from "@/lib/archivedSubjectsStore";

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/api/subjects");
      setSubjects(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message ? String(err.message) : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e) {
    e.preventDefault();
    setCreateError(null);

    const trimmed = name.trim();
    if (!trimmed) return;

    setCreating(true);
    try {
      await apiFetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      setName("");
      await load();
    } catch (err) {
      setCreateError(err?.message ? String(err.message) : String(err));
    } finally {
      setCreating(false);
    }
  }

  async function deleteSubject(subject) {
    const subjectId = String(subject?.id || "");
    if (!subjectId) return;

    const confirmed = window.confirm(
      `Supprimer le dossier "${subject?.name || subjectId}" ?`,
    );
    if (!confirmed) return;

    setDeleteError(null);
    setDeletingId(subjectId);
    try {
      await apiFetch(`/api/subjects/${encodeURIComponent(subjectId)}`, {
        method: "DELETE",
      });
      setSubjects((current) =>
        current.filter((item) => String(item?.id || "") !== subjectId),
      );
    } catch (err) {
      setDeleteError(err?.message ? String(err.message) : String(err));
    } finally {
      setDeletingId(null);
    }
  }

  const [archiveError, setArchiveError] = useState(null);

  async function archiveSubject(subject, archived = true) {
    const subjectId = String(subject?.id || "");
    if (!subjectId) return;

    const label = archived ? "Archiver" : "Désarchiver";
    const confirmed = window.confirm(
      `${label} le dossier "${subject?.name || subjectId}" ?`,
    );
    if (!confirmed) return;

    setArchiveError(null);
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

      // Reload list to reflect server state
      await load();
    } catch (err) {
      setArchiveError(err?.message ? String(err.message) : String(err));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className=" text-red-900 font-bold text-2xl">Sujets</h1>
        <p className="text-sm font-bold text-blue-900">
          Créez des dossiers de matières ou de sujets pour organiser vos
          révisions.
        </p>
      </div>

      <div className="rounded-xl border bg-white p-4 ring-1 ring-[#800020]">
        <form
          onSubmit={create}
          className="flex flex-col md:flex-row gap-2 md:items-end"
        >
          <div className="flex-1">
            <label className="text-sm font-medium">Nom du sujet</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Système d'exploitation, Réseaux, etc."
              className="input mt-1  hover:ring-1 hover:ring-primary-700/40 hover:border-primary-700 focus:ring-2 focus:ring-primary-600/40 focus:border-primary-700"
            />
            {createError ? (
              <div className="mt-2 text-sm text-red-700 ">{createError}</div>
            ) : null}
          </div>
          <button
            className="btn-primary"
            type="submit"
            disabled={!name.trim() || creating}
          >
            {creating ? "Création…" : "Créer"}
          </button>
        </form>
      </div>

      <div className="flex justify-end">
        <Link href="/subjects/archived" className="btn-outline">
          Voir archivés
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center">
          <Loader label="Chargement…" />
        </div>
      ) : error ? (
        <div className="rounded-xl border bg-white p-6 text-sm text-red-700">
          {error}
        </div>
      ) : subjects.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-center text-sm text-slate-600">
          Aucun sujet pour l&apos;instant. Créez-en un pour commencer.
        </div>
      ) : (
        <div className="space-y-3">
          {deleteError ? (
            <div className="rounded-xl border bg-white p-4 text-sm text-red-700">
              {deleteError}
            </div>
          ) : null}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {subjects.map((s) => (
              <SubjectFolder
                key={s.id}
                subject={s}
                deleting={deletingId === String(s.id)}
                onDelete={deleteSubject}
                onArchive={archiveSubject}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
