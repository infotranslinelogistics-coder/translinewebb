import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import type { Page } from '../App';
import logo from '../assets/Translines (2).png';

interface HeaderProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export function Header({ currentPage, onNavigate }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { label: string; page: Page }[] = [
    { label: 'Home', page: 'home' },
    { label: 'Services', page: 'services' },
    { label: 'Fleet', page: 'fleet' },
    { label: 'FAQ', page: 'faq' },
    { label: 'Contact', page: 'contact' },
  ];

  const handleNavigate = (page: Page) => {
    onNavigate(page);
    setMobileMenuOpen(false);
    window.scrollTo(0, 0);
  };

  return (
    <header className="bg-gradient-to-r from-white via-[#FFF7F7] to-white border-b border-[#FAD4D4]/70 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <button
            onClick={() => handleNavigate('home')}
            className="interactive-button flex items-center gap-3 bg-[#FEF2F2]/80 px-4 py-2 rounded-xl border border-[#FAD4D4]/80 shadow-sm"
          >
            <img
              src={logo}
              alt="Transline Logistics"
              className="h-12 w-auto animate-logo-pop drop-shadow-sm transition-transform duration-300 ease-out hover:scale-105"
            />
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <button
                key={item.page}
                onClick={() => handleNavigate(item.page)}
                className={`text-button-animate ${
                  currentPage === item.page
                    ? 'text-[#D32323]'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => handleNavigate('quote')}
              className="interactive-button bg-[#D32323] text-white px-6 py-2 rounded hover:bg-[#B01E1E]"
            >
              Get a Quote
            </button>
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-600 hover:text-[#D32323] transition-colors"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden py-4 border-t border-gray-200">
            {navItems.map((item) => (
              <button
                key={item.page}
                onClick={() => handleNavigate(item.page)}
                className={`block w-full text-left px-4 py-3 text-button-animate ${
                  currentPage === item.page
                    ? 'text-[#D32323] bg-[#FEF2F2]'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => handleNavigate('quote')}
              className="interactive-button w-full mt-2 bg-[#D32323] text-white px-4 py-3 rounded hover:bg-[#B01E1E]"
            >
              Get a Quote
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}
