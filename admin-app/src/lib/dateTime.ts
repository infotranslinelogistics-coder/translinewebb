// Perth-timezone date/time formatting, mirrored from the web portal so the
// admin app renders identical timestamps. Uses Intl (supported by Hermes on
// SDK 54 and by the browser on Expo web) with a defensive fallback so a bad
// date can never crash a screen.
const PERTH_TIME_ZONE = 'Australia/Perth';

export const PERTH_TIME_LABEL = 'Perth time';

function makeFormatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat | null {
  try {
    return new Intl.DateTimeFormat('en-AU', { timeZone: PERTH_TIME_ZONE, ...options });
  } catch {
    try {
      return new Intl.DateTimeFormat('en-AU', options);
    } catch {
      return null;
    }
  }
}

const perthDateTimeFormatter = makeFormatter({ dateStyle: 'medium', timeStyle: 'short' });
const perthDateFormatter = makeFormatter({ dateStyle: 'medium' });
const perthTimeFormatter = makeFormatter({ timeStyle: 'short' });

function toValidDate(value: string | number | Date | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function format(formatter: Intl.DateTimeFormat | null, date: Date): string {
  if (formatter) {
    try {
      return formatter.format(date);
    } catch {
      // fall through
    }
  }
  return date.toLocaleString();
}

export function formatPerthDateTime(
  value: string | number | Date | null | undefined,
  fallback = '—'
): string {
  const date = toValidDate(value);
  return date ? format(perthDateTimeFormatter, date) : fallback;
}

export function formatPerthDate(
  value: string | number | Date | null | undefined,
  fallback = '—'
): string {
  const date = toValidDate(value);
  return date ? format(perthDateFormatter, date) : fallback;
}

export function formatPerthTime(
  value: string | number | Date | null | undefined,
  fallback = '—'
): string {
  const date = toValidDate(value);
  return date ? format(perthTimeFormatter, date) : fallback;
}
