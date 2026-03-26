import { useState, useCallback, useRef } from 'react';
import * as EteService from '../lib/etebase';

export function useCalendar() {
  const [calendars, setCalendars] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const itemCache = useRef({});
  const itemManager = useRef(null);

  const showStatus = useCallback((msg) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), 2800);
  }, []);

  const loadCalendars = useCallback(async () => {
    const cols = await EteService.fetchCalendars();
    const withMeta = await Promise.all(
      cols.map(async (c) => ({
        col: c,
        uid: c.uid,
        name: (await c.getMeta()).name || c.uid,
      })),
    );
    setCalendars(withMeta);
    return withMeta;
  }, []);

  const selectCalendar = useCallback(
    async (col) => {
      setLoading(true);
      showStatus('Lädt…');
      itemManager.current = EteService.getItemManager(col);
      const { events: evs, cache } = await EteService.loadEvents(
        itemManager.current,
      );
      evs.forEach((e) => {
        e.calUid = col.uid;
        e.id = e.uid;
      });
      Object.values(cache).forEach((item) => {
        item._calUid = col.uid;
        item._mgr = itemManager.current;
      });
      itemCache.current = cache;
      setEvents(evs);
      setLoading(false);
      showStatus('Synchronisiert ✓');
    },
    [showStatus],
  );

  const selectAll = useCallback(
    async (cols) => {
      setLoading(true);
      showStatus('Lädt alle Kalender…');
      const allEvents = [];
      const allCache = {};
      for (const col of cols) {
        const mgr = EteService.getItemManager(col.col);
        const { events: evs, cache } = await EteService.loadEvents(mgr);
        evs.forEach((e) => {
          e.calUid = col.uid;
          e.id = e.uid;
        });
        Object.entries(cache).forEach(([k, v]) => {
          v._calUid = col.uid;
          v._mgr = mgr;
          allCache[k] = v;
        });
        allEvents.push(...evs);
      }
      if (cols.length > 0) {
        itemManager.current = EteService.getItemManager(
          cols[cols.length - 1].col,
        );
      }
      itemCache.current = allCache;
      setEvents(allEvents);
      setLoading(false);
      showStatus('Synchronisiert ✓');
    },
    [showStatus],
  );

  const sync = useCallback(
    async (col, all, cols) => {
      if (all) await selectAll(cols);
      else if (col) await selectCalendar(col);
    },
    [selectCalendar, selectAll],
  );

  const addEvent = useCallback(
    async (data) => {
      const col = calendars.find((c) => c.uid === data.calUid);
      const mgr = col
        ? EteService.getItemManager(col.col)
        : itemManager.current;
      const { uid, item } = await EteService.createEvent(mgr, data);
      item._calUid = col?.uid;
      item._mgr = mgr;
      itemCache.current[uid] = item;
      setEvents((prev) => [...prev, { id: uid, ...data }]);
      showStatus('Gespeichert ✓');
    },
    [showStatus, calendars],
  );

  const editEvent = useCallback(
    async (uid, data) => {
      const item = itemCache.current[uid];
      if (!item) return;
      showStatus('Speichert…');
      const mgr = item._mgr || itemManager.current;
      await EteService.updateEvent(mgr, item, { ...data, uid });
      setEvents((prev) => {
        const old = prev.find((e) => e.id === uid) || {};
        return [
          ...prev.filter((e) => e.id !== uid),
          {
            ...old,
            id: uid,
            ...data,
          },
        ];
      });
      showStatus('Gespeichert ✓');
    },
    [showStatus, calendars],
  );

  const removeEvent = useCallback(
    async (uid, mode = 'all', evData = null) => {
      const item = itemCache.current[uid];
      if (!item) return;
      showStatus('Löscht…');
      const mgr = item._mgr || itemManager.current;
      if (mode === 'this' && evData?.start) {
        await EteService.excludeEventInstance(mgr, item, evData.start);
        setEvents((prev) => prev.filter((e) => e.id !== uid));
      } else {
        await EteService.deleteEvent(mgr, item);
        delete itemCache.current[uid];
        setEvents((prev) => prev.filter((e) => e.id !== uid));
      }
      showStatus('Gelöscht ✓');
    },
    [showStatus, calendars],
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
  };
}
