import { useState } from 'react';
import { COLORS } from '../constants/colors';

export default function CalendarEditModal({
  calendar,
  onSave,
  onDelete,
  onClose,
}) {
  const [name, setName] = useState(calendar.name || '');
  const [description, setDescription] = useState(calendar.description || '');
  const [color, setColor] = useState(calendar.color || '#6c63ff');
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleSave() {
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: description.trim(), color });
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-md w-full">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold">Kalender bearbeiten</h3>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            ✕
          </button>
        </div>

        <fieldset className="fieldset mb-3">
          <legend className="fieldset-legend">Name</legend>
          <input
            className="input input-bordered w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Kalender Name"
            autoFocus
          />
        </fieldset>

        <fieldset className="fieldset mb-3">
          <legend className="fieldset-legend">Beschreibung</legend>
          <input
            className="input input-bordered w-full"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
          />
        </fieldset>

        <fieldset className="fieldset mb-4">
          <legend className="fieldset-legend">Farbe</legend>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setColor(c.value)}
                className="w-8 h-8 rounded-full border-2 transition-all"
                style={{
                  backgroundColor: c.value,
                  borderColor: color === c.value ? '#fff' : 'transparent',
                  transform: color === c.value ? 'scale(1.2)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </fieldset>

        {confirmDelete ? (
          <div className="bg-error/10 rounded-lg p-3 mb-4 text-sm">
            <p className="text-error font-medium mb-2">
              Kalender wirklich löschen?
            </p>
            <p className="text-base-content/60 mb-3">
              Alle Events in diesem Kalender werden unwiderruflich gelöscht.
            </p>
            <div className="flex gap-2">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setConfirmDelete(false)}
              >
                Abbrechen
              </button>
              <button className="btn btn-error btn-sm" onClick={onDelete}>
                Ja, löschen
              </button>
            </div>
          </div>
        ) : (
          <button
            className="btn btn-ghost btn-sm text-error mb-4"
            onClick={() => setConfirmDelete(true)}
          >
            🗑 Kalender löschen
          </button>
        )}

        <div className="modal-action mt-0">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Abbrechen
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={!name.trim()}
          >
            Speichern
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
}
