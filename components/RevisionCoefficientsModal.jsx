import ModalShell from '@/components/ModalShell';

export default function RevisionCoefficientsModal({
  open,
  onClose,
  subjects,
  coefficients,
  setCoefficients,
}) {
  if (!open) return null;

  return (
    <ModalShell title="Coefficients des matières" onClose={onClose}>
      {!subjects?.length ? (
        <p className="text-sm text-slate-500">Aucune matière détectée pour le moment.</p>
      ) : (
        <div className="grid gap-2">
          {subjects.map((subject) => (
            <div
              key={subject}
              className="flex items-center justify-between gap-4 p-3 border border-slate-200 rounded-lg"
            >
              <span className="text-sm font-semibold text-slate-800">{subject}</span>
              <input
                type="number"
                min={0}
                step={1}
                value={
                  Number.isFinite(Number(coefficients?.[subject]))
                    ? Number(coefficients?.[subject])
                    : 1
                }
                onChange={(e) =>
                  setCoefficients((prev) => ({
                    ...prev,
                    [subject]: Math.max(0, Number(e.target.value)),
                  }))
                }
                className="w-28 px-3 py-2 border border-slate-200 rounded-lg text-sm text-right"
                aria-label={`Coefficient pour ${subject}`}
              />
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  );
}
