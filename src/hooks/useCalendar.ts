import { useState, useCallback, useRef } from 'react';
import * as EteService from '../lib/etebase';
import type { Calendar, CalendarEvent } from '../types';
import type * as Etebase from 'etebase';

interface CachedItem extends Etebase.Item {
  _calUid?: string;
  _mgr?: Etebase.ItemManager;
}

export function useCalendar() {
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const itemCache = useRef<Record<string, CachedItem>>({});
  const itemManager = useRef<Etebase.ItemManager | null>(null);

  const showStatus = useCallback((msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), 2800);
  }, []);

  const loadCalendars = useCallback(async (): Promise<Calendar[]> => {
    const cols = await EteService.fetchCalendars();
    const withMeta = await Promise.all(
      cols.map(async (c) => {
        const meta = await c.getMeta();
        return {
          col: c,
          uid: c.uid,
          name: meta.name || c.uid,
          description: meta.description || '',
          color: meta.color || null,
          selected: false,
        } as Calendar;
      }),
    );
    setCalendars(withMeta);
    return withMeta;
  }, []);

  const selectCalendar = useCallback(
    async (col: Etebase.Collection) => {
      setLoading(true);
      showStatus('Lädt…');
      itemManager.current = EteService.getItemManager(col);
      const { events: evs, cache } = await EteService.loadEvents(
        itemManager.current,
      );
      evs.forEach((e) => {
        e.calUid = col.uid;
      });
      Object.values(cache).forEach((item) => {
        (item as CachedItem)._calUid = col.uid;
        (item as CachedItem)._mgr = itemManager.current!;
      });
      itemCache.current = cache as Record<string, CachedItem>;
      setEvents(evs as CalendarEvent[]);
      setLoading(false);
      showStatus('Synchronisiert ✓');
    },
    [showStatus],
  );

  const selectAll = useCallback(
    async (cols: Calendar[]) => {
      setLoading(true);
      showStatus('Lädt alle Kalender…');
      const allEvents: Partial<CalendarEvent>[] = [];
      const allCache: Record<string, CachedItem> = {};
      for (const col of cols) {
        const mgr = EteService.getItemManager(col.col);
        const { events: evs, cache } = await EteService.loadEvents(mgr);
        evs.forEach((e) => {
          e.calUid = col.uid;
        });
        Object.entries(cache).forEach(([k, v]) => {
          (v as CachedItem)._calUid = col.uid;
          (v as CachedItem)._mgr = mgr;
          allCache[k] = v as CachedItem;
        });
        allEvents.push(...evs);
      }
      if (cols.length > 0) {
        itemManager.current = EteService.getItemManager(
          cols[cols.length - 1].col,
        );
      }
      itemCache.current = allCache;
      setEvents(allEvents as CalendarEvent[]);
      setLoading(false);
      showStatus('Synchronisiert ✓');
    },
    [showStatus],
  );

  const sync = useCallback(
    async (col: Etebase.Collection | null, all: boolean, cols: Calendar[]) => {
      if (all) await selectAll(cols);
      else if (col) await selectCalendar(col);
    },
    [selectCalendar, selectAll],
  );

  const addEvent = useCallback(
    async (data: CalendarEvent) => {
      const col = calendars.find((c) => c.uid === data.calUid);
      const mgr = col
        ? EteService.getItemManager(col.col)
        : itemManager.current!;

      const { uid, item } = await EteService.createEvent(mgr, {
        ...data,
        uid: data.uid ?? '',
        title: data.title ?? '',
        start: data.start ?? new Date(),
        end: data.end ?? new Date(),
        allDay: data.allDay ?? false,
      });
      (item as CachedItem)._calUid = col?.uid;
      (item as CachedItem)._mgr = mgr;
      itemCache.current[uid] = item as CachedItem;

      setEvents((prev) => [...prev, { ...data, id: uid }]);
      showStatus('Gespeichert ✓');
    },
    [showStatus, calendars],
  );

  const editEvent = useCallback(
    async (uid: string, data: CalendarEvent) => {
      const item = itemCache.current[uid];
      if (!item) return;
      showStatus('Speichert…');

      const oldCalUid = item._calUid;
      const newCalUid = data.calUid;
      const calChanged = oldCalUid !== newCalUid;

      if (calChanged) {
        const oldMgr = item._mgr || itemManager.current!;
        await EteService.deleteEvent(oldMgr, item);

        const newCal = calendars.find((c) => c.uid === newCalUid);
        const newMgr = EteService.getItemManager(newCal!.col);
        const { uid: newUid, item: newItem } = await EteService.createEvent(
          newMgr,
          {
            ...data,
            uid: data.uid ?? uid,
            title: data.title ?? '',
            start: data.start ?? new Date(),
            end: data.end ?? new Date(),
            allDay: data.allDay ?? false,
          },
        );
        (newItem as CachedItem)._calUid = newCalUid;
        (newItem as CachedItem)._mgr = newMgr;
        itemCache.current[newUid] = newItem as CachedItem;
        delete itemCache.current[uid];
      } else {
        const mgr = item._mgr || itemManager.current!;
        await EteService.updateEvent(mgr, item, {
          ...data,
          uid: data.uid ?? uid,
          title: data.title ?? '',
          start: data.start ?? new Date(),
          end: data.end ?? new Date(),
          allDay: data.allDay ?? false,
        });
      }

      setEvents((prev) =>
        prev.map((e) => (e.id === uid ? { ...e, ...data } : e)),
      );
      showStatus('Gespeichert ✓');
    },
    [showStatus, calendars],
  );

  const removeEvent = useCallback(
    async (
      uid: string,
      mode: 'all' | 'this' = 'all',
      evData: CalendarEvent | null = null,
    ) => {
      const item = itemCache.current[uid];
      if (!item) return;
      showStatus('Löscht…');
      const mgr = item._mgr || itemManager.current!;

      if (mode === 'this' && evData?.start) {
        await EteService.excludeEventInstance(mgr, item, evData.start);
      } else {
        await EteService.deleteEvent(mgr, item);
        delete itemCache.current[uid];
      }

      setEvents((prev) => prev.filter((e) => e.id !== uid));
      showStatus('Gelöscht ✓');
    },
    [showStatus],
  );

  const deleteCalendar = useCallback(
    async (uid: string) => {
      const cal = calendars.find((c) => c.uid === uid);
      await EteService.deleteCalendar(cal!.col);
      setCalendars((prev) => prev.filter((c) => c.uid !== uid));
      setEvents((prev) => prev.filter((e) => e.calUid !== uid));
    },
    [calendars],
  );

  return {
    calendars,
    events,
    loading,
    status,
    loadCalendars,
    selectCalendar,
    selectAll,
    sync,
    addEvent,
    editEvent,
    removeEvent,
    deleteCalendar,
  };
}
