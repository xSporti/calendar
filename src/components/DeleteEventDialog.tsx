import { useState } from 'react';

type DeleteMode = 'all' | 'this' | 'following';

interface Props {
  isRecurring: boolean;
  onConfirm: (mode: DeleteMode) => void;
  onCancel: () => void;
}

export function DeleteEventDialog({ isRecurring, onConfirm, onCancel }: Props) {
  const [mode, setMode] = useState<DeleteMode>('this');

  if (!isRecurring) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-6 shadow-xl w-80">
          <p className="font-medium mb-4">Termin löschen?</p>
          <div className="flex gap-2 justify-end">
            <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm">
              Abbrechen
            </button>
            <button
              onClick={() => onConfirm('all')}
              className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm"
            >
              Löschen
            </button>
          </div>
        </div>
      </div>
    );
  }

  const options: { value: DeleteMode; label: string }[] = [
    { value: 'this', label: 'Nur dieser Termin' },
    { value: 'following', label: 'Dieser und alle folgenden' },
    { value: 'all', label: 'Alle Termine der Serie' },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 shadow-xl w-80">
        <p className="font-medium mb-4">Wiederkehrendes Event löschen</p>
        <div className="flex flex-col gap-2 mb-6">
          {options.map(({ value, label }) => (
            <label
              key={value}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="radio"
                name="deleteMode"
                value={value}
                checked={mode === value}
                onChange={() => setMode(value)}
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm">
            Abbrechen
          </button>
          <button
            onClick={() => onConfirm(mode)}
            className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm"
          >
            Löschen
          </button>
        </div>
      </div>
    </div>
  );
}
