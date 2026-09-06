import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import logo from '../assets/transline-logo-lockup.png';

const nav = [
  ['Freight', '/freight'],
  ['Coverage', '/coverage'],
  ['Fleet', '/fleet'],
  ['Driver tracking', '/driver-tracking'],
  ['About', '/about'],
];

export function Header({ path = '/' }: { path?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener('hashchange', close);
    return () => window.removeEventListener('hashchange', close);
  }, []);

  return (
    <header className="siteHeader">
      <a className="siteHeader__brand" href="/" aria-label="Transline Logistics home">
        <img src={logo} alt="Transline Logistics" width="1016" height="271" />
      </a>
      <nav className="siteHeader__nav" aria-label="Primary navigation">
        {nav.map(([label, href]) => <a key={href} href={href} aria-current={path === href ? 'page' : undefined}>{label}</a>)}
      </nav>
      <a className="siteHeader__portal" href="/portal/login">Admin portal <span aria-hidden="true">↗</span></a>
      <button className="siteHeader__menu" type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-navigation" aria-label="Toggle navigation">
        {open ? <X /> : <Menu />}
      </button>
      {open && (
        <nav id="mobile-navigation" className="siteHeader__mobile" aria-label="Mobile navigation">
          {nav.map(([label, href]) => <a key={href} href={href} aria-current={path === href ? 'page' : undefined} onClick={() => setOpen(false)}>{label}</a>)}
          <a href="/portal/login">Admin portal ↗</a>
        </nav>
      )}
    </header>
  );
}
