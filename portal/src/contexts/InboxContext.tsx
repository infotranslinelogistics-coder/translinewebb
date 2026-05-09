import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  acknowledgeMaintenanceItem,
  listAdminInboxNotifications,
  markMaintenanceItemCompleted,
  type AdminInboxNotification,
} from '@/lib/db/maintenance';

interface InboxContextValue {
  notifications: AdminInboxNotification[];
  loading: boolean;
  busyId: string | null;
  unreadCount: number;
  refresh: () => Promise<void>;
  acknowledge: (id: string) => Promise<void>;
  complete: (id: string) => Promise<void>;
}

const InboxContext = createContext<InboxContextValue | null>(null);

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AdminInboxNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const unreadCount = useMemo(() => notifications.length, [notifications]);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await listAdminInboxNotifications();
      setNotifications(rows);
    } catch (err) {
      console.error('InboxContext: failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const acknowledge = useCallback(async (id: string) => {
    try {
      setBusyId(id);
      await acknowledgeMaintenanceItem(id);
      // Re-fetch so both popup and notification centre stay in sync with DB
      const rows = await listAdminInboxNotifications();
      setNotifications(rows);
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
      const rows = await listAdminInboxNotifications();
      setNotifications(rows);
    } catch (err) {
      console.error('InboxContext: failed to complete:', err);
    } finally {
      setBusyId(null);
    }
  }, []);

  return (
    <InboxContext.Provider value={{ notifications, loading, busyId, unreadCount, refresh, acknowledge, complete }}>
      {children}
    </InboxContext.Provider>
  );
}

export function useInbox(): InboxContextValue {
  const ctx = useContext(InboxContext);
  if (!ctx) throw new Error('useInbox must be used within an InboxProvider');
  return ctx;
}
