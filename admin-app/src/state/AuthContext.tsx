import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };

    // Admin app is admin-only: block accounts linked to a driver record,
    // same rule the web portal enforces.
    if (data.user?.id) {
      const { data: driverRow, error: driverLookupError } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (driverLookupError) {
        return { error: new Error('Unable to verify admin access right now. Please try again.') };
      }
      if (driverRow) {
        await supabase.auth.signOut({ scope: 'local' });
        return { error: new Error('Drivers cannot log in to the admin app.') };
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signIn, signOut, isAuthenticated: Boolean(user && session) }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
