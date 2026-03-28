import * as Etebase from 'etebase';
import ICAL from 'ical.js';
import type { CalendarEvent } from '../types';

let _account: Etebase.Account | null = null;

const SESSION_KEY = 'etebase_session';
const ENCRYPTION_KEY = 'etebase_enc_key';

async function getOrCreateEncryptionKey(): Promise<Uint8Array> {
  const stored = localStorage.getItem(ENCRYPTION_KEY);
  if (stored) {
    return new Uint8Array(JSON.parse(stored));
  }
  const key = crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(ENCRYPTION_KEY, JSON.stringify(Array.from(key)));
  return key;
}

export async function login(
  serverUrl: string,
  username: string,
  password: string,
) {
  await Etebase.ready;
  _account = await Etebase.Account.login(username, password, serverUrl);
  const key = await getOrCreateEncryptionKey();
  const session = await _account.save(key);
  localStorage.setItem(SESSION_KEY, session);
  return _account;
}

export async function restoreSession(): Promise<boolean> {
  const session = localStorage.getItem(SESSION_KEY);
  const keyData = localStorage.getItem(ENCRYPTION_KEY);
  if (!session || !keyData) return false;
  try {
    await Etebase.ready;
    const key = new Uint8Array(JSON.parse(keyData));
    _account = await Etebase.Account.restore(session, key);
    return true;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ENCRYPTION_KEY);
    return false;
  }
}

export async function logout() {
  if (_account) await _account.logout();
  _account = null;
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(ENCRYPTION_KEY);
}
export function hasSession(): boolean {
  return !!localStorage.getItem(SESSION_KEY);
}

export function getAccount(): Etebase.Account | null {
  return _account;
}

export async function fetchCalendars(): Promise<Etebase.Collection[]> {
  const mgr = _account!.getCollectionManager();
  const res = await mgr.list('etebase.vevent');
  return res.data.filter((c) => !c.isDeleted);
}

export function getItemManager(
  collection: Etebase.Collection,
): Etebase.ItemManager {
  const mgr = _account!.getCollectionManager();
  return mgr.getItemManager(collection);
}

function parseICS(
  icsString: string,
  uid: string,
): Partial<CalendarEvent> | null {
  try {
    const jcal = ICAL.parse(icsString);
    const comp = new ICAL.Component(jcal);
    const vevent = comp.getFirstSubcomponent('vevent');
    if (!vevent) return null;

    const ev = new ICAL.Event(vevent);
    const isAllDay = ev.startDate.isDate;

    const result: Partial<CalendarEvent> & { dtstart?: string } = {
      title: ev.summary || '(kein Titel)',
      start: ev.startDate.toJSDate(),
      end: ev.endDate ? ev.endDate.toJSDate() : undefined,
      description: ev.description || '',
      allDay: isAllDay,
      id: uid,
    };

    const rrule = vevent.getFirstPropertyValue('rrule');
    if (rrule) {
      result.rrule = rrule.toString();
      const d = ev.startDate.toJSDate();
      const pad = (n: number) => String(n).padStart(2, '0');
      result.dtstart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    return result;
  } catch {
    return null;
  }
}

interface BuildICSParams {
  uid: string;
  title: string;
  start: Date;
  end?: Date;
  description?: string;
  location?: string;
  rrule?: string;
  allDay?: boolean;
}

export function buildICS({
  uid,
  title,
  start,
  end,
  description,
  location,
  rrule,
  allDay,
}: BuildICSParams): string {
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const fmtDate = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  };
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//sporti-cal//DE',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    allDay ? `DTSTART;VALUE=DATE:${fmtDate(start)}` : `DTSTART:${fmt(start)}`,
    allDay
      ? `DTEND;VALUE=DATE:${fmtDate(end || start)}`
      : `DTEND:${fmt(end || start)}`,
    `SUMMARY:${title || ''}`,
  ];
  if (description) lines.push(`DESCRIPTION:${description}`);
  if (location) lines.push(`LOCATION:${location}`);
  if (rrule) lines.push(`RRULE:${rrule}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

interface LoadEventsResult {
  events: Partial<CalendarEvent>[];
  cache: Record<string, Etebase.Item>;
}

export async function loadEvents(
  itemManager: Etebase.ItemManager,
): Promise<LoadEventsResult> {
  const items = await itemManager.list();
  const events: Partial<CalendarEvent>[] = [];
  const cache: Record<string, Etebase.Item> = {};
  for (const item of items.data) {
    if (item.isDeleted) continue;
    try {
      const content = await item.getContent(Etebase.OutputFormat.String);
      const ev = parseICS(content, item.uid);
      if (ev) {
        cache[item.uid] = item;
        events.push(ev);
      }
    } catch (e) {
      console.error(
        'Event konnte nicht geladen werden:',
        item.uid,
        (e as Error).message,
      );
    }
  }
  return { events, cache };
}

export async function createEvent(
  itemManager: Etebase.ItemManager,
  data: BuildICSParams,
): Promise<{ uid: string; item: Etebase.Item }> {
  const uid = crypto.randomUUID();
  const ics = buildICS({ ...data, uid });
  const item = await itemManager.create(
    { mtime: Date.now(), name: data.title },
    ics,
  );
  await itemManager.batch([item]);
  return { uid: item.uid, item };
}

export async function updateEvent(
  itemManager: Etebase.ItemManager,
  item: Etebase.Item,
  data: BuildICSParams,
): Promise<void> {
  const meta = await item.getMeta();
  const ics = buildICS(data);
  await item.setContent(ics);
  await item.setMeta({ ...meta, mtime: Date.now() });
  await itemManager.batch([item]);
}

export async function deleteEvent(
  itemManager: Etebase.ItemManager,
  item: Etebase.Item,
): Promise<void> {
  await item.delete(true);
  await itemManager.batch([item]);
}

export async function excludeEventInstance(
  itemManager: Etebase.ItemManager,
  item: Etebase.Item,
  instanceStart: Date | string,
): Promise<void> {
  const content = await item.getContent(Etebase.OutputFormat.String);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const exdate = `EXDATE:${fmt(new Date(instanceStart))}`;
  const updated = content.replace('END:VEVENT', `${exdate}\r\nEND:VEVENT`);
  const meta = await item.getMeta();
  await item.setContent(updated);
  await item.setMeta({ ...meta, mtime: Date.now() });
  await itemManager.batch([item]);
}

export async function createCalendar(
  name: string,
  description: string,
  color: string,
): Promise<Etebase.Collection> {
  const mgr = _account!.getCollectionManager();
  const collection = await mgr.create(
    'etebase.vevent',
    { name, description, color, mtime: Date.now() },
    '',
  );
  await mgr.upload(collection);
  return collection;
}

export async function updateCalendar(
  collection: Etebase.Collection,
  name: string,
  description: string,
  color: string,
): Promise<void> {
  const mgr = _account!.getCollectionManager();
  const meta = await collection.getMeta();
  await collection.setMeta({
    ...meta,
    name,
    description,
    color,
    mtime: Date.now(),
  });
  await mgr.upload(collection);
}

export async function deleteCalendar(
  collection: Etebase.Collection,
): Promise<void> {
  const mgr = _account!.getCollectionManager();
  await collection.delete();
  await mgr.upload(collection);
}
