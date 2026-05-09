// Authentication context for TransLine Admin Portal
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any; user?: User }>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for active session on mount
    const initAuth = async () => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
        }
      } catch (error) {
        console.error('Failed to get session:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);

      // Persist session to localStorage if needed
      if (currentSession) {
        localStorage.setItem('supabase.session', JSON.stringify(currentSession));
      } else {
        localStorage.removeItem('supabase.session');
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error: any; user?: User }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      // Portal is admin-only: block accounts linked to a driver record.
      if (data.user?.id) {
        const { data: driverRow, error: driverLookupError } = await supabase
          .from('drivers')
          .select('id')
          .eq('user_id', data.user.id)
          .maybeSingle();

        if (driverLookupError) {
          console.error('Failed to verify portal access role:', driverLookupError);
          await supabase.auth.signOut({ scope: 'local' });
          return {
            error: new Error('Unable to verify portal access right now. Please try again.'),
          };
        }

        if (driverRow) {
          await supabase.auth.signOut({ scope: 'local' });
          return {
            error: new Error('Drivers cannot log in to the admin portal.'),
          };
        }
      }

      // Session is automatically set by onAuthStateChange listener
      return { error: null, user: data.user || undefined };
    } catch (error) {
      return { error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Failed to sign out:', error);
    } finally {
      // Always clear local auth state so the UI reliably returns to login.
      setUser(null);
      setSession(null);
      localStorage.removeItem('supabase.session');
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signOut,
    isAuthenticated: !!user && !!session,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    console.error('useAuth called outside AuthProvider; falling back to unauthenticated state.');
    return {
      user: null,
      session: null,
      loading: false,
      signIn: async () => ({ error: new Error('Auth is not initialized.') }),
      signOut: async () => {},
      isAuthenticated: false,
    };
  }
  return context;
}
