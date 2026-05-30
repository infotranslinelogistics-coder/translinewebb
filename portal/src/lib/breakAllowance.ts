export const BREAK_ALLOWANCE_SECONDS = 30 * 60;

export type BreakEventLike = {
  event_type: string;
  created_at: string;
};

export type BreakSession = {
  startAt: string;
  endAt: string | null;
  durationSeconds: number;
  isOpen: boolean;
};

export type BreakAllowanceSummary = {
  allowanceSeconds: number;
  rawBreakSeconds: number;
  countedBreakSeconds: number;
  exceededBySeconds: number;
  remainingSeconds: number;
  status: 'within' | 'exceeded';
  isOnBreak: boolean;
  isAllowanceUsedUp: boolean;
  canStartBreak: boolean;
  blockMessage: string | null;
  shouldAutoEndCurrentBreak: boolean;
  latestBreakStartAt: string | null;
  latestBreakEndAt: string | null;
  currentBreakSeconds: number | null;
  sessions: BreakSession[];
};

const toTimestamp = (value: string) => {
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
};

export function summarizeBreakAllowance(
  events: BreakEventLike[],
  options?: {
    now?: number;
    allowanceSeconds?: number;
  }
): BreakAllowanceSummary {
  const now = options?.now ?? Date.now();
  const allowanceSeconds = options?.allowanceSeconds ?? BREAK_ALLOWANCE_SECONDS;

  const breakEvents = events
    .filter((event) => event.event_type === 'break_start' || event.event_type === 'break_end')
    .sort((a, b) => {
      const aTs = toTimestamp(a.created_at) ?? 0;
      const bTs = toTimestamp(b.created_at) ?? 0;
      return aTs - bTs;
    });

  const sessions: BreakSession[] = [];
  let openBreakStartAt: string | null = null;
  let latestBreakStartAt: string | null = null;
  let latestBreakEndAt: string | null = null;
  let rawBreakSeconds = 0;
  let currentBreakSeconds: number | null = null;

  breakEvents.forEach((event) => {
    const eventMs = toTimestamp(event.created_at);
    if (eventMs == null) return;

    if (event.event_type === 'break_start') {
      if (openBreakStartAt) {
        return;
      }

      openBreakStartAt = event.created_at;
      latestBreakStartAt = event.created_at;
      return;
    }

    latestBreakEndAt = event.created_at;

    if (!openBreakStartAt) {
      return;
    }

    const startMs = toTimestamp(openBreakStartAt);
    if (startMs == null) {
      openBreakStartAt = null;
      return;
    }

    const durationSeconds = Math.max(0, Math.floor((eventMs - startMs) / 1000));
    rawBreakSeconds += durationSeconds;
    sessions.push({
      startAt: openBreakStartAt,
      endAt: event.created_at,
      durationSeconds,
      isOpen: false,
    });
    openBreakStartAt = null;
  });

  if (openBreakStartAt) {
    const startMs = toTimestamp(openBreakStartAt);
    if (startMs != null) {
      currentBreakSeconds = Math.max(0, Math.floor((now - startMs) / 1000));
      rawBreakSeconds += currentBreakSeconds;
      sessions.push({
        startAt: openBreakStartAt,
        endAt: null,
        durationSeconds: currentBreakSeconds,
        isOpen: true,
      });
    }
  }

  const countedBreakSeconds = Math.min(rawBreakSeconds, allowanceSeconds);
  const exceededBySeconds = Math.max(0, rawBreakSeconds - allowanceSeconds);
  const isAllowanceUsedUp = rawBreakSeconds >= allowanceSeconds;

  return {
    allowanceSeconds,
    rawBreakSeconds,
    countedBreakSeconds,
    exceededBySeconds,
    remainingSeconds: Math.max(0, allowanceSeconds - rawBreakSeconds),
    status: exceededBySeconds > 0 ? 'exceeded' : 'within',
    isOnBreak: Boolean(openBreakStartAt),
    isAllowanceUsedUp,
    canStartBreak: !openBreakStartAt && !isAllowanceUsedUp,
    blockMessage: !openBreakStartAt && isAllowanceUsedUp ? 'Break allowance already used.' : null,
    shouldAutoEndCurrentBreak: Boolean(openBreakStartAt) && isAllowanceUsedUp,
    latestBreakStartAt,
    latestBreakEndAt,
    currentBreakSeconds,
    sessions,
  };
}

export function computeWorkingSeconds(
  shiftStartedAt: string | null | undefined,
  shiftEndedAt: string | null | undefined,
  breakSummary: Pick<BreakAllowanceSummary, 'countedBreakSeconds'>,
  now = Date.now()
): number | null {
  if (!shiftStartedAt) return null;

  const startMs = toTimestamp(shiftStartedAt);
  if (startMs == null) return null;

  const endMs = shiftEndedAt ? toTimestamp(shiftEndedAt) : now;
  if (endMs == null) return null;

  const shiftSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));
  return Math.max(0, shiftSeconds - Math.max(0, breakSummary.countedBreakSeconds));
}
