import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  acknowledgeMaintenanceItem,
  listAdminInboxNotifications,
  markMaintenanceItemCompleted,
  type AdminInboxNotification,
} from '@/lib/db/maintenance';
import { countPendingChecklistApprovals } from '@/lib/db/checklistApprovals';
import { useAuth } from '@/contexts/AuthContext';

interface InboxContextValue {
  notifications: AdminInboxNotification[];
  checklistPendingCount: number;
  loading: boolean;
  busyId: string | null;
  unreadCount: number;
  refresh: () => Promise<void>;
  acknowledge: (id: string) => Promise<void>;
  complete: (id: string) => Promise<void>;
}

const InboxContext = createContext<InboxContextValue | null>(null);

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<AdminInboxNotification[]>([]);
  const [checklistPendingCount, setChecklistPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isUnauthorizedError = (err: unknown): boolean => {
    if (!err || typeof err !== 'object') return false;
    const maybeError = err as { status?: number | string; code?: string | number; message?: string };
    const status = typeof maybeError.status === 'string' ? Number(maybeError.status) : maybeError.status;

    if (status === 401 || status === 403) return true;
    if (maybeError.code === '401' || maybeError.code === '403') return true;

    const message = (maybeError.message ?? '').toLowerCase();
    return message.includes('jwt') || message.includes('not authenticated') || message.includes('permission denied');
  };

  const unreadCount = useMemo(
    () => notifications.length + checklistPendingCount,
    [notifications.length, checklistPendingCount]
  );

  const refresh = useCallback(async () => {
    if (!isAuthenticated || authLoading) {
      setNotifications([]);
      setChecklistPendingCount(0);
      return;
    }

    try {
      setLoading(true);
      const [rows, pendingChecklistCount] = await Promise.all([
        listAdminInboxNotifications(),
        countPendingChecklistApprovals(),
      ]);
      setNotifications(rows);
      setChecklistPendingCount(pendingChecklistCount);
    } catch (err) {
      if (isUnauthorizedError(err)) {
        setNotifications([]);
        setChecklistPendingCount(0);
        return;
      }
      console.error('InboxContext: failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      setNotifications([]);
      setChecklistPendingCount(0);
      return;
    }

    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh, isAuthenticated, authLoading]);

  const acknowledge = useCallback(async (id: string) => {
    try {
      setBusyId(id);
      await acknowledgeMaintenanceItem(id);
      // Re-fetch so both popup and notification centre stay in sync with DB
      const [rows, pendingChecklistCount] = await Promise.all([
        listAdminInboxNotifications(),
        countPendingChecklistApprovals(),
      ]);
      setNotifications(rows);
      setChecklistPendingCount(pendingChecklistCount);
    } catch (err) {
      console.error('InboxContext: failed to acknowledge:', err);
    } finally {
      setBusyId(null);
    }
  }, []);

  const complete = useCallback(async (id: string) => {
    try {
      setBusyId(id);
      await markMaintenanceItemCompleted(id);
      const [rows, pendingChecklistCount] = await Promise.all([
        listAdminInboxNotifications(),
        countPendingChecklistApprovals(),
      ]);
      setNotifications(rows);
      setChecklistPendingCount(pendingChecklistCount);
    } catch (err) {
      console.error('InboxContext: failed to complete:', err);
    } finally {
      setBusyId(null);
    }
  }, []);

  return (
    <InboxContext.Provider
      value={{
        notifications,
        checklistPendingCount,
        loading,
        busyId,
        unreadCount,
        refresh,
        acknowledge,
        complete,
      }}
    >
      {children}
    </InboxContext.Provider>
  );
}

export function useInbox(): InboxContextValue {
  const ctx = useContext(InboxContext);
  if (!ctx) throw new Error('useInbox must be used within an InboxProvider');
  return ctx;
}
