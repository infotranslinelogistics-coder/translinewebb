import { describe, expect, it } from 'vitest';
import { BREAK_ALLOWANCE_SECONDS, computeWorkingSeconds, summarizeBreakAllowance } from '@/lib/breakAllowance';

const ts = {
  start: '2026-05-30T00:00:00.000Z',
  m10: '2026-05-30T00:10:00.000Z',
  m15: '2026-05-30T00:15:00.000Z',
  m25: '2026-05-30T00:25:00.000Z',
  m30: '2026-05-30T00:30:00.000Z',
  m31: '2026-05-30T00:31:00.000Z',
  h8: '2026-05-30T08:00:00.000Z',
};

describe('break allowance rules', () => {
  it('10m + 15m = allowed', () => {
    const summary = summarizeBreakAllowance([
      { event_type: 'break_start', created_at: ts.start },
      { event_type: 'break_end', created_at: ts.m10 },
      { event_type: 'break_start', created_at: ts.m10 },
      { event_type: 'break_end', created_at: ts.m25 },
    ]);

    expect(summary.rawBreakSeconds).toBe(25 * 60);
    expect(summary.status).toBe('within');
    expect(summary.isAllowanceUsedUp).toBe(false);
    expect(summary.canStartBreak).toBe(true);
  });

  it('10m + 15m + 5m = exactly used', () => {
    const summary = summarizeBreakAllowance([
      { event_type: 'break_start', created_at: ts.start },
      { event_type: 'break_end', created_at: ts.m10 },
      { event_type: 'break_start', created_at: ts.m10 },
      { event_type: 'break_end', created_at: ts.m25 },
      { event_type: 'break_start', created_at: ts.m25 },
      { event_type: 'break_end', created_at: ts.m30 },
    ]);

    expect(summary.rawBreakSeconds).toBe(BREAK_ALLOWANCE_SECONDS);
    expect(summary.status).toBe('within');
    expect(summary.isAllowanceUsedUp).toBe(true);
    expect(summary.canStartBreak).toBe(false);
    expect(summary.blockMessage).toBe('Break allowance already used.');
  });

  it('30m used then start break = blocked', () => {
    const summary = summarizeBreakAllowance([
      { event_type: 'break_start', created_at: ts.start },
      { event_type: 'break_end', created_at: ts.m30 },
    ]);

    expect(summary.rawBreakSeconds).toBe(BREAK_ALLOWANCE_SECONDS);
    expect(summary.canStartBreak).toBe(false);
    expect(summary.blockMessage).toBe('Break allowance already used.');
  });

  it('31m total = flagged exceeded', () => {
    const summary = summarizeBreakAllowance([
      { event_type: 'break_start', created_at: ts.start },
      { event_type: 'break_end', created_at: ts.m31 },
    ]);

    expect(summary.rawBreakSeconds).toBe(31 * 60);
    expect(summary.status).toBe('exceeded');
    expect(summary.exceededBySeconds).toBe(60);
    expect(summary.countedBreakSeconds).toBe(BREAK_ALLOWANCE_SECONDS);
  });

  it('working time subtracts maximum 30 minutes only', () => {
    const summary = summarizeBreakAllowance([
      { event_type: 'break_start', created_at: ts.start },
      { event_type: 'break_end', created_at: ts.m31 },
    ]);

    const working = computeWorkingSeconds(ts.start, ts.h8, summary);
    expect(working).toBe(7.5 * 60 * 60);
  });
});
