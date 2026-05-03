"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, FileQuestion, Trash2 } from "lucide-react";

const folderColors = [
  { background: "#eef6ff", border: "#60a5fa", accent: "#1d4ed8" },
  { background: "#f0fdf4", border: "#4ade80", accent: "#15803d" },
  { background: "#fff7ed", border: "#fb923c", accent: "#c2410c" },
  { background: "#fdf2f8", border: "#f472b6", accent: "#be185d" },
  { background: "#f5f3ff", border: "#a78bfa", accent: "#6d28d9" },
  { background: "#ecfeff", border: "#22d3ee", accent: "#0e7490" },
  { background: "#fefce8", border: "#facc15", accent: "#a16207" },
  { background: "#f1f5f9", border: "#94a3b8", accent: "#334155" },
];

function getFolderColor(name = "") {
  const key = String(name || "").trim().toLowerCase();
  let hash = 2166136261;

  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return folderColors[Math.abs(hash) % folderColors.length];
}

export default function SubjectFolder({
  subject,
  deleting = false,
  onDelete,
  onArchive,
}) {
  const router = useRouter();
  const [menuPosition, setMenuPosition] = useState(null);
  const folderColor = getFolderColor(subject?.name || subject?.id);
  const fileCount = Number(subject?.fileCount || 0);
  const qcmCount = Number(subject?.qcmCount || 0);
  const uploadHref = `/subjects/${subject.id}/upload`;

  const menuOpen = Boolean(menuPosition);

  useEffect(() => {
    if (!menuOpen) return;

    function closeMenu() {
      setMenuPosition(null);
    }

    function closeOnEscape(e) {
      if (e.key === "Escape") closeMenu();
    }

    document.addEventListener("click", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);

    return () => {
      document.removeEventListener("click", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [menuOpen]);

  function openUpload() {
    router.push(uploadHref);
  }

  function closeMenu() {
    setMenuPosition(null);
  }

  function handleContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 208;
    const menuHeight = 144;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 12);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 12);

    setMenuPosition({
      x: Math.max(12, x),
      y: Math.max(12, y),
    });
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
    closeMenu();
    onDelete?.(subject);
  }

  function handleArchive(e) {
    e.stopPropagation();
    closeMenu();
    onArchive?.(subject);
  }

  return (
    <div
      className="rounded-xl border p-3 cursor-pointer transition hover:ring-2"
      style={{
        backgroundColor: folderColor.background,
        borderColor: folderColor.border,
        "--tw-ring-color": `${folderColor.border}66`,
      }}
      role="button"
      tabIndex={0}
      onClick={openUpload}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div
              className="font-semibold truncate"
              style={{ color: folderColor.accent }}
            >
              {subject.name}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              {fileCount} fichier{fileCount > 1 ? "s" : ""} · {qcmCount} QCM
            </div>
          </div>
        </div>
      </div>

      {menuOpen ? (
        <div
          className="fixed z-50 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg ring-1 ring-black/5"
          style={{ left: menuPosition.x, top: menuPosition.y }}
          onClick={(e) => e.stopPropagation()}
          role="menu"
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left font-medium text-blue-900 hover:bg-blue-50"
            onClick={(e) => {
              e.stopPropagation();
              closeMenu();
              openUpload();
            }}
            role="menuitem"
          >
            <FileQuestion size={16} />
            Générer QCM
          </button>

          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleDelete}
            disabled={deleting}
            role="menuitem"
          >
            <Trash2 size={16} />
            {deleting ? "Suppression..." : "Supprimer"}
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left font-medium text-slate-700 hover:bg-slate-50"
            onClick={handleArchive}
            role="menuitem"
          >
            <Archive size={16} />
            Archiver
          </button>
        </div>
      ) : null}
    </div>
  );
}
