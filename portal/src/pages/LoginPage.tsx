import React, { useState } from 'react';
import { Navigate } from 'react-router';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { RouteMap } from '@shared/components/RouteMap';
import logo from '@/assets/transline-logo-lockup.png';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, signIn } = useAuth();

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        setError(signInError.message.includes('Invalid login credentials') ? 'Email or password not recognised.' : signInError.message);
        setLoading(false);
      }
    } catch (caught) {
      console.error('Sign in error:', caught);
      setError('Sign in could not be completed. Try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_.95fr] bg-[#F5F2EB]">
      <section className="relative hidden lg:flex min-h-screen flex-col justify-between overflow-hidden bg-[#0B0C0D] p-10 text-white">
        <img src={logo} alt="Transline Logistics" className="relative z-10 w-56" />
        <div className="absolute inset-x-0 top-20 opacity-80">
          <RouteMap variant="portal" theme="dark" />
        </div>
        <div className="relative z-10 max-w-xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[.16em] text-[#E2485A]">Operations portal</p>
          <h1 className="portalShellTitle text-[clamp(4rem,7vw,7.5rem)] font-bold leading-[.78] text-white">Every load.<br />One view.</h1>
          <p className="mt-7 max-w-md text-base leading-7 text-[#A6A6A6]">Shifts, vehicles, service events and live locations — tied back to the work.</p>
        </div>
      </section>

      <main className="flex min-h-screen items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <img src={logo} alt="Transline Logistics" className="mb-12 w-52 lg:hidden" />
          <div className="mb-10">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[.14em] text-[#BE1C2D]">Secure access</p>
            <h2 className="portalShellTitle text-5xl font-bold leading-none text-[#17191B]">Sign in to dispatch.</h2>
            <p className="mt-4 text-sm leading-6 text-[#686B6F]">Use your approved Transline account.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive" className="rounded-none border-[#A61B29] bg-[#FBE9E9] text-[#7A1520]">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-[#35383B]">Email</Label>
              <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="h-12 rounded-none border-0 border-b border-[#A6A6A6] bg-transparent px-0 text-[#17191B] placeholder:text-[#A6A6A6] focus-visible:ring-0" placeholder="name@transline.com.au" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-[#35383B]">Password</Label>
              <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required className="h-12 rounded-none border-0 border-b border-[#A6A6A6] bg-transparent px-0 text-[#17191B] placeholder:text-[#A6A6A6] focus-visible:ring-0" placeholder="Enter password" />
            </div>
            <Button type="submit" disabled={loading} className="mt-2 h-12 w-full justify-between rounded-none bg-[#BE1C2D] px-4 text-white hover:bg-[#A81828]">
              {loading ? 'Checking account…' : 'Sign in'} <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
          <p className="mt-8 text-xs text-[#686B6F]">Account access is logged. Contact dispatch if your account is locked.</p>
        </div>
      </main>
    </div>
  );
}
