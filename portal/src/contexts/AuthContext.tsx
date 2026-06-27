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

function logLogoutSource(reason: string) {
  console.error('[AUTH LOGOUT SOURCE]', reason);
}

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
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (event === 'SIGNED_OUT') {
        console.error('[AUTH LOGOUT SOURCE]', 'supabase-auth-state-signed-out');
      }
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

      // Portal is admin-only: require profiles.role === 'admin'.
      if (data.user?.id) {
        const { data: profile, error: profileLookupError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profileLookupError) {
          console.error('Failed to verify portal access role:', profileLookupError);
          return {
            error: new Error('Unable to verify portal access right now. Please try again.'),
          };
        }

        if (!profile || profile.role !== 'admin') {
          console.error('Non-admin account detected during portal sign-in.');
          await supabase.auth.signOut({ scope: 'local' });
          return {
            error: new Error('This account does not have admin access.'),
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
      logLogoutSource('explicit-user-logout');
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
