import { Analytics } from '@vercel/analytics/react';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { HomePage } from './components/HomePage';
import { Pages } from './site/Pages';
import { getPage } from './site/catalog';
import './site/site.css';

export type Page = 'home' | 'services' | 'fleet' | 'contact' | 'quote' | 'faq' | 'privacy' | 'terms';

export default function App({ path = '/' }: { path?: string }) {
  const page = getPage(path);
  return (
    <div className="min-h-screen bg-surface-dark text-surface-white">
      <a className="skipLink" href="#main-content">Skip to content</a>
      <Header path={page.path} />
      <main id="main-content">
        {page.kind === 'home' ? <HomePage /> : <Pages page={page} />}
      </main>
      <Footer />
      <Analytics />
    </div>
  );
}
