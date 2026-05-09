const PERTH_TIME_ZONE = 'Australia/Perth';

const perthDateTimeFormatter = new Intl.DateTimeFormat('en-AU', {
  timeZone: PERTH_TIME_ZONE,
  dateStyle: 'medium',
  timeStyle: 'short',
});

const perthDateFormatter = new Intl.DateTimeFormat('en-AU', {
  timeZone: PERTH_TIME_ZONE,
  dateStyle: 'medium',
});

const perthTimeFormatter = new Intl.DateTimeFormat('en-AU', {
  timeZone: PERTH_TIME_ZONE,
  timeStyle: 'short',
});

function toValidDate(value: string | number | Date | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const PERTH_TIME_LABEL = 'Perth time';

export function formatPerthDateTime(value: string | number | Date | null | undefined, fallback = '—') {
  const date = toValidDate(value);
  return date ? perthDateTimeFormatter.format(date) : fallback;
}

export function formatPerthDate(value: string | number | Date | null | undefined, fallback = '—') {
  const date = toValidDate(value);
  return date ? perthDateFormatter.format(date) : fallback;
}

export function formatPerthTime(value: string | number | Date | null | undefined, fallback = '—') {
  const date = toValidDate(value);
  return date ? perthTimeFormatter.format(date) : fallback;
}