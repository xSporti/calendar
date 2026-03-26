import * as Etebase from 'etebase';
import ICAL from 'ical.js';

let _account = null;

export async function login(serverUrl, username, password) {
  await Etebase.ready;
  _account = await Etebase.Account.login(username, password, serverUrl);
  return _account;
}

export async function logout() {
  if (_account) await _account.logout();
  _account = null;
}

export function getAccount() {
  return _account;
}

export async function fetchCalendars() {
  const mgr = _account.getCollectionManager();
  const res = await mgr.list('etebase.vevent');
  return res.data;
}

export function getItemManager(collection) {
  const mgr = _account.getCollectionManager();
  return mgr.getItemManager(collection);
}

function parseICS(icsString, uid) {
  try {
    const jcal = ICAL.parse(icsString);
    const comp = new ICAL.Component(jcal);
    const vevent = comp.getFirstSubcomponent('vevent');
    if (!vevent) return null;

    const ev = new ICAL.Event(vevent);
    const isAllDay = ev.startDate.isDate;

    const result = {
      title: ev.summary || '(kein Titel)',
      start: ev.startDate.toJSDate(),
      end: ev.endDate ? ev.endDate.toJSDate() : undefined,
      description: ev.description || '',
      allDay: isAllDay,
      uid,
    };

    const rrule = vevent.getFirstPropertyValue('rrule');
    if (rrule) {
      result.rrule = rrule.toString();
      const d = ev.startDate.toJSDate();
      const pad = (n) => String(n).padStart(2, '0');
      result.dtstart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    return result;
  } catch {
    return null;
  }
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
}) {
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const fmtDate = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
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

export async function loadEvents(itemManager) {
  const items = await itemManager.list();
  const events = [];
  const cache = {};
  for (const item of items.data) {
    if (item.isDeleted) continue;
    try {
      const content = await item.getContent(1);
      const ev = parseICS(content, item.uid);
      if (ev) {
        cache[item.uid] = item;
        events.push(ev);
      }
    } catch (e) {
      console.error('Event konnte nicht geladen werden:', item.uid, e.message);
    }
  }
  return { events, cache };
}

export async function createEvent(itemManager, data) {
  const uid = crypto.randomUUID();
  const ics = buildICS({ uid, ...data });
  const item = await itemManager.create(
    { mtime: Date.now(), name: data.title },
    ics,
  );
  await itemManager.batch([item]);
  return { uid: item.uid, item };
}

export async function updateEvent(itemManager, item, data) {
  const meta = await item.getMeta();
  const ics = buildICS(data);
  await item.setContent(ics);
  await item.setMeta({ ...meta, mtime: Date.now() });
  await itemManager.batch([item]);
}

export async function deleteEvent(itemManager, item) {
  item.delete(true);
  await itemManager.batch([item]);
}

export async function excludeEventInstance(itemManager, item, instanceStart) {
  const content = await item.getContent(1);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const exdate = `EXDATE:${fmt(new Date(instanceStart))}`;
  const updated = content.replace('END:VEVENT', `${exdate}\r\nEND:VEVENT`);
  const meta = await item.getMeta();
  await item.setContent(updated);
  await item.setMeta({ ...meta, mtime: Date.now() });
  await itemManager.batch([item]);
}

export async function createCalendar(name, description, color) {
  const mgr = _account.getCollectionManager();
  const collection = await mgr.create(
    'etebase.vevent',
    { name, description, color, mtime: Date.now() },
    '',
  );
  await mgr.upload(collection);
  return collection;
}
export async function updateCalendar(collection, name, description, color) {
  const mgr = _account.getCollectionManager();
  const meta = collection.getMeta();
  await collection.setMeta({
    ...meta,
    name,
    description,
    color,
    mtime: Date.now(),
  });
  await mgr.upload(collection);
}

export async function deleteCalendar(collection) {
  const mgr = _account.getCollectionManager();
  await mgr.delete(collection);
  await mgr.upload(collection);
}
