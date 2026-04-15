import ModalShell from '@/components/ModalShell';

export default function RevisionAvailabilityModal({
  open,
  onClose,
  days,
  dayLabel,
  availability,
  setAvailability,
  sessionDuration,
  setSessionDuration,
}) {
  if (!open) return null;

  const updateDay = (day, updater) => {
    setAvailability((prev) => {
      const currentDay = prev?.[day] ?? { enabled: false, slots: [{ start: '16:00', end: '18:00' }] };
      return {
        ...prev,
        [day]: updater(currentDay),
      };
    });
  };

  const addSlot = (day) => {
    updateDay(day, (currentDay) => {
      const slots = Array.isArray(currentDay?.slots) ? currentDay.slots : [];
      const lastSlot = slots[slots.length - 1] ?? { start: '16:00', end: '18:00' };
      return {
        ...currentDay,
        enabled: true,
        slots: [...slots, { start: lastSlot.start || '16:00', end: lastSlot.end || '18:00' }],
      };
    });
  };

  const removeSlot = (day, index) => {
    updateDay(day, (currentDay) => {
      const slots = Array.isArray(currentDay?.slots) ? currentDay.slots : [];
      if (slots.length <= 1) return currentDay;
      return {
        ...currentDay,
        slots: slots.filter((_, idx) => idx !== index),
      };
    });
  };

  const updateSlotValue = (day, index, key, value) => {
    updateDay(day, (currentDay) => {
      const slots = Array.isArray(currentDay?.slots) ? currentDay.slots : [];
      const safeSlots = slots.length > 0 ? slots : [{ start: '16:00', end: '18:00' }];
      return {
        ...currentDay,
        slots: safeSlots.map((slot, idx) => {
          if (idx !== index) return slot;
          return {
            ...slot,
            [key]: value,
          };
        }),
      };
    });
  };

  return (
    <ModalShell title="Disponibilités de révision" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-slate-700">Durée</label>
            <select
              value={sessionDuration}
              onChange={(e) => setSessionDuration(Number(e.target.value))}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
            >
              {[30, 45, 60, 90].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-2">
          {days.map((day) => {
            const row = availability?.[day] ?? {};
            const slots = Array.isArray(row?.slots) && row.slots.length > 0
              ? row.slots
              : [{ start: row?.start || '16:00', end: row?.end || '18:00' }];
            return (
              <div key={day} className="p-3 border border-slate-200 rounded-lg space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 min-w-[8rem]">
                    <input
                      type="checkbox"
                      checked={!!row.enabled}
                      onChange={(e) =>
                        updateDay(day, (currentDay) => ({
                          ...currentDay,
                          enabled: e.target.checked,
                        }))
                      }
                      className="accent-primary-800"
                    />
                    <span className="text-sm font-semibold text-slate-800">{dayLabel?.[day] ?? day}</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => addSlot(day)}
                    className="h-8 w-8 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                    disabled={!row.enabled}
                    aria-label={`Ajouter un créneau pour ${dayLabel?.[day] ?? day}`}
                    title="Ajouter un créneau"
                  >
                    +
                  </button>
                </div>

                <div className="space-y-2">
                  {slots.map((slot, index) => (
                    <div key={`${day}-${index}`} className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-slate-500">De</span>
                      <input
                        type="time"
                        value={slot?.start || '16:00'}
                        onChange={(e) => updateSlotValue(day, index, 'start', e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        disabled={!row.enabled}
                      />
                      <span className="text-sm text-slate-500">à</span>
                      <input
                        type="time"
                        value={slot?.end || '18:00'}
                        onChange={(e) => updateSlotValue(day, index, 'end', e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        disabled={!row.enabled}
                      />
                      <button
                        type="button"
                        onClick={() => removeSlot(day, index)}
                        className="h-8 w-8 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40"
                        disabled={!row.enabled || slots.length <= 1}
                        aria-label={`Supprimer le créneau ${index + 1} de ${dayLabel?.[day] ?? day}`}
                        title="Supprimer ce créneau"
                      >
                        -
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ModalShell>
  );
}
