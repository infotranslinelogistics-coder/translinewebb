import { Mail, Phone } from 'lucide-react';
import type { Page } from '../App';
import logo from '../assets/Translines (2).png';

interface FooterProps {
  onNavigate: (page: Page) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  const handleNavigate = (page: Page) => {
    onNavigate(page);
    window.scrollTo(0, 0);
  };

  return (
    <footer className="bg-gradient-to-b from-[#1B0B0B] via-[#130909] to-[#0B0909] text-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="md:col-span-1">
            <div className="interactive-button flex items-center gap-3 mb-4 w-fit rounded-xl bg-[#FEF2F2]/90 px-4 py-2 border border-[#FAD4D4]/80 shadow-lg shadow-[#D32323]/10">
              <img
                src={logo}
                alt="Transline Logistics"
                className="h-10 w-auto animate-logo-pop transition-transform duration-300 ease-out hover:scale-105 drop-shadow-sm"
              />
              <div className="text-sm font-semibold text-[#8A1B1B] tracking-wide">
                Transline Logistics
              </div>
            </div>
            <p className="text-sm text-gray-300/90">
              Reliable freight and transport solutions across Perth.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => handleNavigate('home')}
                  className="text-sm text-button-animate hover:text-white"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNavigate('services')}
                  className="text-sm text-button-animate hover:text-white"
                >
                  Services
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNavigate('fleet')}
                  className="text-sm text-button-animate hover:text-white"
                >
                  Fleet
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNavigate('faq')}
                  className="text-sm text-button-animate hover:text-white"
                >
                  FAQ
                </button>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-white mb-4">Services</h3>
            <ul className="space-y-2 text-sm">
              <li>Freight Delivery</li>
              <li>Courier Services</li>
              <li>Removals</li>
              <li>Commercial Transport</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white mb-4">Contact</h3>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4" />
                <span>0466582734</span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4" />
                <span>admin@translinelogistics.org</span>
              </li>
            </ul>
            <button
              onClick={() => handleNavigate('quote')}
              className="interactive-button mt-4 bg-[#D32323] text-white px-6 py-2 rounded hover:bg-[#B01E1E] text-sm"
            >
              Get a Quote
            </button>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} Transline Logistics. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm">
            <button
              onClick={() => handleNavigate('privacy')}
              className="text-button-animate hover:text-white"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => handleNavigate('terms')}
              className="text-button-animate hover:text-white"
            >
              Terms & Conditions
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
