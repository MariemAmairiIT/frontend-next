"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SubjectFolder({ subject, deleting = false, onDelete }) {
  const router = useRouter();
  const fileCount = Number(subject?.fileCount || 0);
  const qcmCount = Number(subject?.qcmCount || 0);
  const uploadHref = `/subjects/${subject.id}/upload`;

  function openUpload() {
    router.push(uploadHref);
  }

  function handleKeyDown(e) {
    if (e.target !== e.currentTarget) return;

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openUpload();
    }
  }

  function handleDelete(e) {
    e.stopPropagation();
    onDelete?.(subject);
  }

  return (
    <div
      className="rounded-xl border bg-white p-4 cursor-pointer transition hover:border-primary-800 hover:ring-1 hover:ring-primary-800/30"
      role="button"
      tabIndex={0}
      onClick={openUpload}
      onKeyDown={handleKeyDown}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="font-semibold truncate">{subject.name}</div>
            <div className="mt-1 text-xs text-slate-600">
              {fileCount} fichier{fileCount > 1 ? "s" : ""} · {qcmCount} QCM
            </div>
          </div>
          <div className="text-xs text-slate-500">{subject.id}</div>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/subjects/${subject.id}/qcm`}
            className="btn-primary"
            onClick={(e) => e.stopPropagation()}
          >
            Générer QCM
          </Link>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-red-700 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Suppression..." : "Supprimer"}
          </button>
        </div>
      </div>
    </div>
  );
}
