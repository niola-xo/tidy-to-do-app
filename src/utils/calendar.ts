// Calendar utilities for Phase 3.5: Calendar Export (Level 1)

export interface CalendarTask {
  id: string;
  text: string;
  due_date?: string | null;
  due_time?: string | null;
  is_done?: boolean;
  completed?: boolean;
  space_id?: string;
  list_id?: string | null;
}

export interface CalendarSpace {
  id: string;
  name: string;
}

export interface CalendarList {
  id: string;
  title: string;
}

/**
 * Creates a prefilled Google Calendar "create event" link.
 * Opens in browser: https://calendar.google.com/calendar/render?action=TEMPLATE
 */
export function createGoogleCalendarUrl({
  title,
  date,
  time,
  spaceName,
  listName,
  timezone = 'Africa/Lagos',
}: {
  title: string;
  date: string; // YYYY-MM-DD
  time?: string | null; // HH:mm or HH:mm:ss
  spaceName?: string;
  listName?: string;
  timezone?: string;
}): string {
  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const textParam = encodeURIComponent(title);

  const descParts: string[] = [];
  if (spaceName) descParts.push(`Space: ${spaceName}`);
  if (listName) descParts.push(`List: ${listName}`);
  const details = encodeURIComponent(descParts.join('\n'));

  // Clean date YYYY-MM-DD -> YYYYMMDD
  const dateClean = date.replace(/-/g, '');

  let datesParam = '';
  if (!time) {
    // All-day event: Google Calendar end date is exclusive (day + 1)
    const [y, m, d] = date.split('-').map(Number);
    const nextDate = new Date(Date.UTC(y, m - 1, d + 1));
    const nextDayStr = nextDate.toISOString().split('T')[0].replace(/-/g, '');
    datesParam = `${dateClean}/${nextDayStr}`;
  } else {
    // Timed event (HH:mm)
    const cleanTime = time.slice(0, 5);
    const [hh, mm] = cleanTime.split(':').map(Number);
    const pad = (n: number) => String(n).padStart(2, '0');

    const startStr = `${dateClean}T${pad(hh)}${pad(mm)}00`;
    const endHh = (hh + 1) % 24;

    let endDateClean = dateClean;
    if (endHh < hh) {
      // Wrapped past midnight, advance day by 1
      const [y, m, d] = date.split('-').map(Number);
      const nextDate = new Date(Date.UTC(y, m - 1, d + 1));
      endDateClean = nextDate.toISOString().split('T')[0].replace(/-/g, '');
    }

    const endStr = `${endDateClean}T${pad(endHh)}${pad(mm)}00`;
    datesParam = `${startStr}/${endStr}&ctz=${encodeURIComponent(timezone)}`;
  }

  return `${base}&text=${textParam}&details=${details}&dates=${datesParam}`;
}

/**
 * Escapes characters for iCalendar RFC 5545 format
 */
function escapeIcsText(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n');
}

/**
 * Generates an RFC 5545 compliant .ics string for a list of dated tasks.
 */
export function generateIcs({
  tasks,
  spaces = [],
  lists = [],
  timezone = 'Africa/Lagos',
}: {
  tasks: CalendarTask[];
  spaces?: CalendarSpace[];
  lists?: CalendarList[];
  timezone?: string;
}): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const spaceMap = new Map(spaces.map((s) => [s.id, s.name]));
  const listMap = new Map(lists.map((l) => [l.id, l.title]));

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tidy//Tidy Tasks//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    `TZID:${timezone}`,
    `X-LIC-LOCATION:${timezone}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0100',
    'TZNAME:WAT',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];

  for (const task of tasks) {
    // Only incomplete dated tasks
    const isDone = task.is_done ?? task.completed ?? false;
    if (!task.due_date || isDone) continue;

    const dateClean = task.due_date.replace(/-/g, '');
    const spaceName = task.space_id ? spaceMap.get(task.space_id) : undefined;
    const listName = task.list_id ? listMap.get(task.list_id) : undefined;

    const descParts: string[] = [];
    if (spaceName) descParts.push(`Space: ${spaceName}`);
    if (listName) descParts.push(`List: ${listName}`);
    const description = descParts.join('\n');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${task.id || Math.random().toString(36).slice(2)}@tidy.app`);
    lines.push(`DTSTAMP:${dtstamp}`);

    if (!task.due_time) {
      // All-day event (inclusive DTSTART, exclusive DTEND next day)
      const [y, m, d] = task.due_date.split('-').map(Number);
      const nextDate = new Date(Date.UTC(y, m - 1, d + 1));
      const nextDayClean = nextDate.toISOString().split('T')[0].replace(/-/g, '');

      lines.push(`DTSTART;VALUE=DATE:${dateClean}`);
      lines.push(`DTEND;VALUE=DATE:${nextDayClean}`);
    } else {
      // Timed event (HH:mm)
      const cleanTime = task.due_time.slice(0, 5);
      const [hh, mm] = cleanTime.split(':').map(Number);

      const startStr = `${dateClean}T${pad(hh)}${pad(mm)}00`;
      const endHh = (hh + 1) % 24;

      let endDateClean = dateClean;
      if (endHh < hh) {
        const [y, m, d] = task.due_date.split('-').map(Number);
        const nextDate = new Date(Date.UTC(y, m - 1, d + 1));
        endDateClean = nextDate.toISOString().split('T')[0].replace(/-/g, '');
      }
      const endStr = `${endDateClean}T${pad(endHh)}${pad(mm)}00`;

      lines.push(`DTSTART;TZID=${timezone}:${startStr}`);
      lines.push(`DTEND;TZID=${timezone}:${endStr}`);
    }

    lines.push(`SUMMARY:${escapeIcsText(task.text)}`);
    if (description) {
      lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
    }
    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Triggers a browser download of an .ics calendar file.
 */
export function downloadIcsFile(icsContent: string, filename: string = 'tidy-tasks.ics'): void {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
