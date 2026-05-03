"use client";

export default function Loader({ label = "Traitement…" }) {
  return (
    <div className="flex items-center gap-2" role="status" aria-live="polite">
      <div className="w-10 h-10 rounded-full border-4 border-primary-200 border-t-primary-800 animate-spin" />
      <div className="text-sm text-slate-600">{label}</div>
    </div>
  );
}
