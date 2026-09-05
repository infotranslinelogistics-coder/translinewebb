import { Analytics } from '@vercel/analytics/react';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { HomePage } from './components/HomePage';

export default function App() {
  return (
    <div className="min-h-screen bg-surface-dark text-surface-white">
      <Header />
      <main>
        <HomePage />
      </main>
      <Footer />
      <Analytics />
    </div>
  );
}
