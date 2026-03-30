import type { Collection } from 'etebase';

export interface Calendar {
  col: Collection;
  uid: string;
  name: string;
  description: string;
  color: string | null;
  selected: boolean;
}

export interface CalendarEvent {
  id?: string;
  uid?: string;
  calUid?: string;
  title?: string;
  start?: Date;
  end?: Date;
  exdate?: string[];
  allDay?: boolean;
  description?: string;
  location?: string;
  rrule?: string;
  color?: string;
  dtstart?: string;
  duration?: string;
}
