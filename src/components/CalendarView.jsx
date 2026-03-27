import { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import rrulePlugin from '@fullcalendar/rrule';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import deLocale from '@fullcalendar/core/locales/de';
import EventModal from './EventModal';
import { useCalendar } from '../hooks/useCalendar';
import { logout } from '../lib/etebase';
import CalendarModal from './CalendarModal';
import * as EteService from '../lib/etebase';
import CalendarEditModal from './CalendarEditModal';

const COLORS = [
  'oklch(65% 0.25 290)',
  'oklch(65% 0.2 160)',
  'oklch(65% 0.2 30)',
  'oklch(65% 0.2 0)',
];

export default function CalendarView({ onLogout }) {
  const {
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
  } = useCalendar();

  const [selectedUid, setSelectedUid] = useState('all');
  const [selectedCal, setSelectedCal] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [calModalOpen, setCalModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [defaultStart, setDefaultStart] = useState(null);
  const [moreLinkData, setMoreLinkData] = useState(null);
  const calendarRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [calTitle, setCalTitle] = useState('');
  const [isToday, setIsToday] = useState(true);
  const [editingCal, setEditingCal] = useState(null);

  useEffect(() => {
    loadCalendars().then((cols) => {
      if (cols.length > 0) selectAll(cols);
    });
  }, []);

  function handleSelectCal(uid) {
    if (uid === 'all') {
      setSelectedUid('all');
      setSelectedCal(null);
      selectAll(calendars);
    } else {
      const found = calendars.find((c) => c.uid === uid);
      if (!found) return;
      setSelectedUid(uid);
      setSelectedCal(found);
      selectCalendar(found.col);
    }
  }

  function handleEventClick(info) {
    const ev = events.find((e) => e.id === info.event.id);
    setEditingEvent(ev || null);
    setDefaultStart(null);
    setModalOpen(true);
  }

  async function handleSave(data) {
    setModalOpen(false);
    if (editingEvent)
      await editEvent(editingEvent.id, { uid: editingEvent.id, ...data });
    else await addEvent(data);
  }

  async function handleDelete(mode = 'all') {
    if (!editingEvent) return;
    setModalOpen(false);
    await removeEvent(editingEvent.id, mode, editingEvent);
  }

  async function handleCreateCalendar(data) {
    setCalModalOpen(false);
    await EteService.createCalendar(data.name, data.description, data.color);
    const cols = await loadCalendars();
    selectAll(cols);
  }

  async function handleEditCalendar(uid, data) {
    const cal = calendars.find((c) => c.uid === uid);
    await EteService.updateCalendar(
      cal.col,
      data.name,
      data.description,
      data.color,
    );
    setEditingCal(null);
    await loadCalendars();
  }

  async function handleDeleteCalendar(uid) {
    await deleteCalendar(uid);
    setEditingCal(null);
  }

  async function handleLogout() {
    await logout();
    onLogout();
  }

  async function handleEventDrop(info) {
    const ev = events.find((e) => e.id === info.event.id);
    if (!ev) return;
    await editEvent(ev.id, {
      uid: ev.id,
      calUid: ev.calUid,
      title: ev.title,
      start: info.event.start,
      end: info.event.end || info.event.start,
      allDay: info.event.allDay,
      description: ev.description,
      location: ev.location,
      rrule: ev.rrule,
    });
  }

  async function handleEventResize(info) {
    const ev = events.find((e) => e.id === info.event.id);
    if (!ev) return;
    await editEvent(ev.id, {
      uid: ev.id,
      title: ev.title,
      start: info.event.start,
      end: info.event.end || info.event.start,
      allDay: info.event.allDay,
      description: ev.description,
      location: ev.location,
      rrule: ev.rrule,
    });
  }

  const fcEvents = events.map((ev) => {
    const cal = calendars.find((c) => c.uid === ev.calUid);
    const color = cal?.color || COLORS[calendars.indexOf(cal) % COLORS.length];
    const base = {
      id: ev.id,
      title: ev.title,
      backgroundColor: color,
      borderColor: color,
      extendedProps: {
        description: ev.description,
        location: ev.location,
        calUid: ev.calUid,
        rrule: ev.rrule,
        internalId: ev.id,
      },
    };
    if (ev.rrule) {
      return {
        ...base,
        allDay: ev.allDay || false,
        rrule: {
          dtstart: ev.dtstart, // lokale Zeit ohne Z — kommt aus etebase.js
          ...Object.fromEntries(
            ev.rrule.split(';').map((part) => {
              const [k, v] = part.split('=');
              return [k.toLowerCase(), v?.toLowerCase()];
            }),
          ),
        },
        duration: ev.duration || '01:00',
      };
    }
    return {
      ...base,
      start: ev.start,
      end: ev.end,
      allDay: ev.allDay || false,
    };
  });

  return (
    <div className="flex flex-col h-screen bg-base-100">
      <div className="navbar bg-base-200 border-b border-base-300 min-h-12 px-4 gap-2">
        <div className="navbar-start gap-3">
          <button
            className="btn btn-ghost btn-sm btn-square"
            onClick={() => {
              setSidebarOpen((v) => {
                setTimeout(
                  () => calendarRef.current?.getApi().updateSize(),
                  310,
                );
                return !v;
              });
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <span className="text-xl font-semibold text-primary tracking-wide">
            Kalender
          </span>

          {/* Navigation */}
          <button
            className="btn btn-ghost btn-sm btn-square btn-outline btn-primary text-3xl"
            onClick={() => calendarRef.current.getApi().prev()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            className="btn btn-ghost btn-sm btn-square btn-outline btn-primary text-3xl"
            onClick={() => calendarRef.current.getApi().next()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>

          <button
            className={`btn btn-sm ${isToday ? 'btn-ghost cursor-default pointer-events-none' : 'btn-ghost btn-outline btn-primary'}`}
            onClick={() => !isToday && calendarRef.current.getApi().today()}
          >
            Heute
          </button>
        </div>

        <div className="navbar-center">
          <span className="font-semibold text-base">{calTitle}</span>
        </div>

        <div className="navbar-end gap-2">
          {loading && (
            <span className="loading loading-spinner loading-xs opacity-50" />
          )}
          <div className="join">
            <button
              className="join-item btn btn-sm btn-outline btn-primary"
              onClick={() =>
                calendarRef.current.getApi().changeView('dayGridMonth')
              }
            >
              Monat
            </button>
            <button
              className="join-item btn btn-sm btn-outline btn-primary"
              onClick={() =>
                calendarRef.current.getApi().changeView('timeGridWeek')
              }
            >
              Woche
            </button>
            <button
              className="join-item btn btn-sm btn-outline btn-primary"
              onClick={() =>
                calendarRef.current.getApi().changeView('timeGridDay')
              }
            >
              Tag
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`transition-all duration-300 overflow-hidden bg-base-200 border-r border-base-300 flex flex-col gap-4 ${sidebarOpen ? 'w-56 p-3' : 'w-0'}`}
        >
          <div className="text-xs font-semibold text-base-content/50 uppercase tracking-wide whitespace-nowrap">
            Meine Kalender
          </div>
          <ul className="flex flex-col gap-1">
            <li>
              <button
                className="btn btn-ghost btn-sm w-full justify-start gap-2 text-base-content/60 font-normal cursor-pointer"
                onClick={() => setCalModalOpen(true)}
              >
                <span className="text-lg leading-none">+</span>
                <span>Kalender hinzufügen</span>
              </button>
            </li>
            <li>
              <hr className="my-1 border-base-300" />
            </li>
            <li>
              <div
                className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded-lg hover:bg-base-300 transition-colors"
                onClick={() => handleSelectCal('all')}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-base-content/30" />
                <span
                  className={`text-sm truncate whitespace-nowrap flex-1 ${selectedUid === 'all' ? 'font-medium text-primary' : ''}`}
                >
                  Alle Kalender
                </span>
              </div>
            </li>
            {calendars.map((c, i) => (
              <li key={c.uid} className="group relative">
                <div
                  className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded-lg hover:bg-base-300 transition-colors"
                  onClick={() => handleSelectCal(c.uid)}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: c.color || COLORS[i % COLORS.length],
                    }}
                  />
                  <span
                    className={`text-sm truncate whitespace-nowrap flex-1 ${selectedUid === c.uid ? 'font-medium text-primary' : ''}`}
                  >
                    {c.name}
                  </span>
                  <button
                    className="btn btn-ghost btn-xs btn-circle opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingCal(c);
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-3.5 h-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-auto flex flex-col gap-1">
            <button
              className="btn btn-primary btn-sm w-full"
              onClick={() => {
                setEditingEvent(null);
                setDefaultStart(null);
                setModalOpen(true);
              }}
            >
              + Termin
            </button>
            <button
              className="btn btn-ghost btn-sm w-full justify-start"
              onClick={() =>
                selectedUid === 'all'
                  ? selectAll(calendars)
                  : sync(selectedCal?.col)
              }
            >
              ↻ Sync
            </button>
            <button
              className="btn btn-ghost btn-sm w-full justify-start text-error"
              onClick={handleLogout}
            >
              Abmelden
            </button>
          </div>
        </aside>

        {/* Kalender */}
        <div className="flex-1 overflow-hidden p-4 pt-0">
          <FullCalendar
            ref={calendarRef}
            plugins={[
              dayGridPlugin,
              timeGridPlugin,
              interactionPlugin,
              rrulePlugin,
            ]}
            initialView="dayGridMonth"
            locale={deLocale}
            firstDay={1}
            timeZone="local"
            headerToolbar={false}
            height="100%"
            dayMaxEvents={true}
            datesSet={(arg) => {
              setCalTitle(arg.view.title);
              const now = new Date();
              setIsToday(now >= arg.start && now < arg.end);
            }}
            moreLinkClick={(info) => {
              setMoreLinkData({
                date: info.date,
                events: info.allSegs.map((seg) => seg.event),
              });
              return 'none';
            }}
            navLinks={true}
            navLinkDayClick={(date) => {
              calendarRef.current.getApi().changeView('timeGridDay', date);
            }}
            events={fcEvents}
            editable={true}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
          />
        </div>

        {modalOpen && (
          <EventModal
            event={editingEvent}
            defaultStart={defaultStart}
            onSave={handleSave}
            onDelete={handleDelete}
            onClose={() => setModalOpen(false)}
            calendars={calendars}
            defaultCalUid={
              selectedUid === 'all' ? calendars[0]?.uid : selectedUid
            }
          />
        )}

        {moreLinkData && (
          <div className="modal modal-open">
            <div className="modal-box max-w-sm">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">
                  {moreLinkData.date.toLocaleDateString('de-DE', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </h3>
                <button
                  className="btn btn-sm btn-ghost btn-circle"
                  onClick={() => setMoreLinkData(null)}
                >
                  ✕
                </button>
              </div>

              {/* Event-Liste */}
              <ul className="flex flex-col gap-1">
                {moreLinkData.events.map((ev) => (
                  <li
                    key={ev.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-base-200 cursor-pointer transition-colors"
                    onClick={() => {
                      setMoreLinkData(null);
                      handleEventClick({ event: ev });
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: ev.backgroundColor }}
                    />
                    {!ev.allDay && (
                      <span className="text-sm text-base-content/50 w-10 shrink-0">
                        {ev.start?.toLocaleTimeString('de-DE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                    <span className="text-md truncate">{ev.title}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* Backdrop */}
            <div
              className="modal-backdrop"
              onClick={() => setMoreLinkData(null)}
            />
          </div>
        )}

        {calModalOpen && (
          <CalendarModal
            onSave={handleCreateCalendar}
            onClose={() => setCalModalOpen(false)}
          />
        )}

        {editingCal && (
          <CalendarEditModal
            calendar={editingCal}
            onSave={(data) => handleEditCalendar(editingCal.uid, data)}
            onDelete={() => handleDeleteCalendar(editingCal.uid)}
            onClose={() => setEditingCal(null)}
          />
        )}

        {status && (
          <div className="toast toast-end toast-bottom">
            <div className="alert alert-info py-2 px-4 text-sm">{status}</div>
          </div>
        )}
      </div>
    </div>
  );
}
