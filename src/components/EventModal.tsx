import { useState, useEffect } from 'react';
import ClockPicker from './ClockPicker';
import type { CalendarEvent, Calendar } from '../types';

const RRULE_PRESETS = [
  { label: 'Keine Wiederholung', value: '' },
  { label: 'Täglich', value: 'FREQ=DAILY' },
  { label: 'Wöchentlich', value: 'FREQ=WEEKLY' },
  { label: 'Alle 2 Wochen', value: 'FREQ=WEEKLY;INTERVAL=2' },
  { label: 'Monatlich', value: 'FREQ=MONTHLY' },
  { label: 'Jährlich', value: 'FREQ=YEARLY' },
];

function toDateStr(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function toTimeStr(date: Date | string | null | undefined): string {
  if (!date) return '09:00';
  const d = new Date(date);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function combine(dateStr: string, timeStr: string): Date | undefined {
  if (!dateStr) return undefined;
  return new Date(`${dateStr}T${timeStr}:00`);
}

interface Props {
  event?: CalendarEvent | null;
  defaultStart?: Date | string | null;
  onSave: (data: CalendarEvent) => void;
  onDelete: (scope?: 'all') => void;
  onClose: () => void;
  calendars: Calendar[];
  defaultCalUid?: string;
}

export default function EventModal({
  event,
  defaultStart,
  onSave,
  onDelete,
  onClose,
  calendars,
  defaultCalUid,
}: Props) {
  const isNew = !event;

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('10:00');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [rrule, setRrule] = useState('');
  const [clockTarget, setClockTarget] = useState<'start' | 'end' | null>(null);
  const [allDay, setAllDay] = useState(false);
  const [calUid, setCalUid] = useState('');

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setStartDate(toDateStr(event.start));
      setStartTime(toTimeStr(event.start));
      const displayEnd =
        event.allDay && event.end
          ? new Date(new Date(event.end).getTime() - 86400000)
          : event.end || event.start;
      setEndDate(toDateStr(displayEnd));
      setEndTime(toTimeStr(event.end || event.start));
      setDescription(event.description || '');
      setLocation(event.location || '');
      setRrule(event.rrule || '');
      setAllDay(event.allDay || false);
      setCalUid(event.calUid || defaultCalUid || '');
    } else {
      const s = defaultStart ? new Date(defaultStart) : new Date();
      s.setMinutes(0, 0, 0);
      const e = new Date(s);
      e.setHours(e.getHours() + 1);
      setStartDate(toDateStr(s));
      setStartTime(toTimeStr(s));
      setEndDate(toDateStr(e));
      setEndTime(toTimeStr(e));
      setTitle('');
      setDescription('');
      setLocation('');
      setRrule('');
      setAllDay(false);
      setCalUid(defaultCalUid || '');
    }
  }, [event, defaultStart]);

  function handleSave() {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      start: allDay
        ? new Date(`${startDate}T00:00:00`)
        : combine(startDate, startTime),
      end: allDay
        ? new Date(new Date(`${endDate}T00:00:00`).getTime() + 86400000)
        : combine(endDate, endTime),
      allDay,
      description: description.trim(),
      location: location.trim(),
      rrule: rrule || undefined,
      calUid,
    });
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-md w-full">
        {/* header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold">
            {isNew ? 'Neuer Termin' : 'Termin bearbeiten'}
          </h3>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* calendar */}
        <fieldset className="fieldset mb-3">
          <legend className="fieldset-legend">Kalender</legend>
          <select
            className="select select-bordered w-full"
            value={calUid}
            onChange={(e) => setCalUid(e.target.value)}
          >
            {calendars.map((c) => (
              <option key={c.uid} value={c.uid}>
                {c.name}
              </option>
            ))}
          </select>
        </fieldset>

        {/* title */}
        <fieldset className="fieldset mb-3">
          <legend className="fieldset-legend">Titel</legend>
          <input
            className="input input-bordered w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Terminbezeichnung"
            autoFocus
          />
        </fieldset>

        {/* allday toggle */}
        <div className="flex items-center gap-3 mb-3">
          <input
            type="checkbox"
            className="toggle toggle-sm toggle-primary"
            id="allday"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
          />
          <label htmlFor="allday" className="text-sm cursor-pointer">
            Ganztägig
          </label>
        </div>
        {/* start */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Start</legend>
            <input
              type="date"
              className="input input-bordered w-full"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </fieldset>
          {!allDay && (
            <fieldset className="fieldset">
              <legend className="fieldset-legend">Uhrzeit</legend>
              <input
                type="time"
                className="input input-bordered w-full font-mono"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                onFocus={() => setClockTarget('start')}
                placeholder="09:00"
              />
            </fieldset>
          )}
        </div>

        {!allDay && clockTarget === 'start' && (
          <div className="flex justify-center mb-4">
            <ClockPicker value={startTime} onChange={setStartTime} />
          </div>
        )}

        {/* end */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Ende</legend>
            <input
              type="date"
              className="input input-bordered w-full"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </fieldset>
          {!allDay && (
            <fieldset className="fieldset">
              <legend className="fieldset-legend">Uhrzeit</legend>
              <input
                type="time"
                className="input input-bordered w-full font-mono"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                onFocus={() => setClockTarget('end')}
                placeholder="10:00"
              />
            </fieldset>
          )}
        </div>

        {!allDay && clockTarget === 'end' && (
          <div className="flex justify-center mb-4">
            <ClockPicker value={endTime} onChange={setEndTime} />
          </div>
        )}

        {/* location */}
        <fieldset className="fieldset mb-3">
          <legend className="fieldset-legend">Ort</legend>
          <input
            className="input input-bordered w-full"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Adresse oder Raum"
          />
        </fieldset>

        {/* recurrence */}
        <fieldset className="fieldset mb-3">
          <legend className="fieldset-legend">Wiederholung</legend>
          <select
            className="select select-bordered w-full"
            value={rrule}
            onChange={(e) => setRrule(e.target.value)}
          >
            {RRULE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </fieldset>

        {/* description */}
        <fieldset className="fieldset mb-4">
          <legend className="fieldset-legend">Beschreibung</legend>
          <textarea
            className="textarea textarea-bordered w-full"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optionale Notizen…"
            rows={3}
          />
        </fieldset>

        {/* actions */}
        <div className="modal-action mt-0">
          {!isNew && !rrule && (
            <button
              className="btn btn-error btn-sm mr-auto"
              onClick={() => onDelete()}
            >
              Löschen
            </button>
          )}
          {!isNew && rrule && (
            <button
              className="btn btn-error btn-sm mr-auto"
              onClick={() => onDelete('all')}
            >
              Alle löschen
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Abbrechen
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={!title.trim()}
          >
            Speichern
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
}
