import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmail, getSession } from '../utils/auth';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if already logged in
    checkExistingSession();
  }, []);

  async function checkExistingSession() {
    try {
      const session = await getSession();
      if (session) {
        navigate('/portal');
      }
    } catch (error) {
      console.error('Session check error:', error);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signInWithEmail(email, password);
      navigate('/portal');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold text-foreground">Admin Portal</h1>
          <p className="text-sm text-muted-foreground">Transline Logistics</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded text-sm text-destructive">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white"
          >
            {loading ? 'Logging in...' : 'Sign In'}
          </Button>
        </form>

        <div className="text-xs text-center text-muted-foreground">
          <p>Protected Administrator Access</p>
          <p className="mt-2">Contact IT for credentials</p>
        </div>
      </Card>
    </div>
  );
}
