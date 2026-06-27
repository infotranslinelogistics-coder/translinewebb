import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { AuthProvider } from '@/contexts/AuthContext';
import { router } from '@/routes';
import { validateEnv } from '@/lib/env';
import { Toaster } from '@/app/components/ui/sonner';

export default function App() {
  useEffect(() => {
    // Validate environment variables on app startup
    validateEnv();
  }, []);

  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <Toaster theme="dark" position="top-right" />
    </AuthProvider>
  );
}
