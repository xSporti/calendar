import * as Etebase from 'etebase';
import type { CalendarEvent } from '../types';

import ICAL from 'ical.js';
import { tzlib_get_ical_block } from 'timezones-ical-library';

function getIcalTimezone(tzid: string): ICAL.Timezone {
  const existing = ICAL.TimezoneService.get(tzid);
  if (existing) return existing;

  const raw = tzlib_get_ical_block(tzid);
  if (!raw || raw.length === 0) {
    throw new Error(`Unbekannte Timezone: ${tzid}`);
  }

  const inner = Array.isArray(raw) ? raw.join('\r\n') : raw;

  // ✅ WICHTIG: tzlib liefert nur den Inhalt — wir bauen den VTIMEZONE-Container selbst
  const vtimezoneString = ['BEGIN:VTIMEZONE', inner, 'END:VTIMEZONE'].join(
    '\r\n',
  );

  const comp = new ICAL.Component(ICAL.parse(vtimezoneString));
  const tz = new ICAL.Timezone({ tzid, component: comp });
  ICAL.TimezoneService.register(tz);
  return tz;
}

const TEST_TIMEZONES = [
  'Europe/Berlin',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Asia/Tokyo',
  'Asia/Dubai',
  'Australia/Sydney',
  'Pacific/Auckland',
  'Asia/Kolkata',
  'UTC',
];

let passed = 0;
let failed = 0;

for (const tzid of TEST_TIMEZONES) {
  try {
    const tz = getIcalTimezone(tzid);
    const again = ICAL.TimezoneService.get(tzid);

    if (!again) {
      throw new Error('nach Registrierung nicht im TimezoneService gefunden');
    }

    if (again.tzid !== tzid) {
      throw new Error(`falsche tzid: ${again.tzid}`);
    }

    console.log(`✅ ${tzid}`);
    passed++;
  } catch (err) {
    console.error(`💥 ${tzid}: ${(err as Error).message}`);
    failed++;
  }
}

console.log(`\n${passed + failed} Tests — ${passed} ✅  ${failed} ❌`);

if (failed > 0) {
  throw new Error(`${failed} Tests fehlgeschlagen`);
}
/* 














*/
let _account: Etebase.Account | null = null;

const SESSION_KEY = 'etebase_session';
const ENCRYPTION_KEY = 'etebase_enc_key';

const fmtUTC = (d: Date): string =>
  d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

const fmtDate = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
};

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

    const result: Partial<CalendarEvent> & {
      dtstart?: string;
      duration?: string;
    } = {
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

      // Lokale Zeit ohne Z — verhindert falsche UTC-Interpretation im rrule Plugin
      const d = ev.startDate.toJSDate();
      const pad = (n: number) => String(n).padStart(2, '0');
      result.dtstart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

      // Duration aus Start/End berechnen
      if (ev.endDate) {
        const diffMs =
          ev.endDate.toJSDate().getTime() - ev.startDate.toJSDate().getTime();
        const diffH = Math.floor(diffMs / 3600000);
        const diffM = Math.floor((diffMs % 3600000) / 60000);
        result.duration = `${String(diffH).padStart(2, '0')}:${String(diffM).padStart(2, '0')}`;
      }

      const exdates = vevent.getAllProperties('exdate');
      if (exdates.length > 0) {
        result.exdate = exdates.map((ex: any) =>
          ex.getFirstValue().toJSDate().toISOString(),
        );
      }
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
  exdate?: string[];
  allDay?: boolean;
  timezone?: string;
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
  timezone = 'Europe/Berlin',
}: BuildICSParams & { timezone?: string }): string {
  const cal = new ICAL.Component(['vcalendar', [], []]);
  cal.updatePropertyWithValue('prodid', '-//sporti-cal//DE');
  cal.updatePropertyWithValue('version', '2.0');

  const tz = ICAL.TimezoneService.get(timezone);
  if (tz && !allDay) {
    cal.addSubcomponent(tz.component);
  }

  const vevent = new ICAL.Component('vevent');
  vevent.updatePropertyWithValue('uid', uid);
  vevent.updatePropertyWithValue('summary', title || '');
  vevent.updatePropertyWithValue('dtstamp', ICAL.Time.now());

  if (allDay) {
    vevent.updatePropertyWithValue(
      'dtstart',
      ICAL.Time.fromDateString(start.toISOString().slice(0, 10)),
    );
    // end fehlt → automatisch +1 Tag
    const endDate = end ?? new Date(start.getTime() + 86400000);
    vevent.updatePropertyWithValue(
      'dtend',
      ICAL.Time.fromDateString(endDate.toISOString().slice(0, 10)),
    );
  } else {
    const dtstart = ICAL.Time.fromJSDate(start, false);
    dtstart.zone = tz ?? ICAL.Timezone.utcTimezone;
    const dtStartProp = vevent.updatePropertyWithValue('dtstart', dtstart);
    dtStartProp.setParameter('tzid', timezone);

    if (end) {
      const dtend = ICAL.Time.fromJSDate(end, false);
      dtend.zone = tz ?? ICAL.Timezone.utcTimezone;
      const dtEndProp = vevent.updatePropertyWithValue('dtend', dtend);
      dtEndProp.setParameter('tzid', timezone);
    }
  }

  if (description) vevent.updatePropertyWithValue('description', description);
  if (location) vevent.updatePropertyWithValue('location', location);
  if (rrule) {
    const rruleProp = new ICAL.Property('rrule');
    rruleProp.setValue(ICAL.Recur.fromString(rrule));
    vevent.addProperty(rruleProp);
  }

  cal.addSubcomponent(vevent);
  return cal.toString();
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
  const content = await item.getContent(1);
  const exdate = `EXDATE:${fmtUTC(new Date(instanceStart))}`;

  if (content.includes(exdate)) return;

  const updated = content.replace('END:VEVENT', `${exdate}\r\nEND:VEVENT`);
  const meta = await item.getMeta();
  await item.setContent(updated);
  await item.setMeta({ ...meta, mtime: Date.now() });
  await itemManager.batch([item]);
}

export async function truncateFromInstance(
  itemManager: Etebase.ItemManager,
  item: Etebase.Item,
  instanceStart: Date | string,
): Promise<void> {
  const content = await item.getContent(1); // war OutputFormat.String — fix!
  const until = new Date(new Date(instanceStart).getTime() - 86400 * 1000);

  const updated = content.replace(/RRULE:([^\r\n]+)/, (_, rruleBody) => {
    const cleaned = rruleBody
      .replace(/;?COUNT=\d+/, '')
      .replace(/;?UNTIL=[^;]+/, '');
    return `RRULE:${cleaned};UNTIL=${fmtUTC(until)}`;
  });

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
