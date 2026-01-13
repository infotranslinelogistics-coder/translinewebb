import { Truck, Package, Home, CheckCircle, Users, Clock, Shield } from 'lucide-react';
import type { Page } from '../App';

interface HomePageProps {
  onNavigate: (page: Page) => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
  const handleNavigate = (page: Page) => {
    onNavigate(page);
    window.scrollTo(0, 0);
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="relative h-[600px] flex items-center scroll-reveal">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1766608422198-5be9ac0aac9e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVpZ2h0JTIwdHJ1Y2slMjBoaWdod2F5fGVufDF8fHx8MTc2NzQ1MTY1MXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral)',
          }}
        >
          <div className="absolute inset-0 bg-black/50"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-white">
          <h1 className="text-white mb-4 max-w-3xl">
            Reliable Freight & Transport Services Across Perth
          </h1>
          <p className="text-xl text-gray-100 mb-8 max-w-2xl">
            From small parcels to heavy freight, our diverse fleet delivers your goods safely and on time, every time.
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => handleNavigate('quote')}
              className="interactive-button bg-[#D32323] text-white px-8 py-3 rounded hover:bg-[#B01E1E]"
            >
              Get a Quote
            </button>
            <button
              onClick={() => handleNavigate('contact')}
              className="interactive-button bg-white text-gray-900 px-8 py-3 rounded hover:bg-gray-100"
            >
              Contact Us
            </button>
          </div>
        </div>
      </section>

      {/* About Overview */}
      <section className="py-16 bg-white scroll-reveal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="mb-6">About Transline Logistics</h2>
            <p className="text-gray-600 mb-4">
              Transline Logistics is a trusted provider of freight delivery, courier services, and removals throughout Perth and surrounding areas. With a company-owned fleet ranging from compact vans to 14-tonne pantechs, we match the right vehicle to every job.
            </p>
            <p className="text-gray-600">
              Whether you need fast courier delivery, palletised freight transport, or full-scale commercial removals, our team ensures your goods arrive safely and on schedule.
            </p>
          </div>
        </div>
      </section>

      {/* Services Overview */}
      <section className="py-16 bg-gray-50 scroll-reveal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-center mb-12">Our Services</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Freight Delivery */}
            <div className="surface-card p-6">
              <div className="bg-[#FEF2F2] w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Truck className="h-6 w-6 text-[#D32323]" />
              </div>
              <h3 className="mb-3">Freight Delivery</h3>
              <p className="text-gray-600 text-sm mb-4">
                Local and regional freight transport for palletised, bulk, and general freight. Reliable service for all load sizes.
              </p>
              <button onClick={() => handleNavigate('services')} className="text-button-animate text-[#D32323] text-sm">
                Learn more →
              </button>
            </div>

            {/* Courier Services */}
            <div className="surface-card p-6">
              <div className="bg-[#FEF2F2] w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Package className="h-6 w-6 text-[#D32323]" />
              </div>
              <h3 className="mb-3">Courier Services</h3>
              <p className="text-gray-600 text-sm mb-4">
                Fast and secure courier delivery for parcels, documents, and time-sensitive items across metro and regional areas.
              </p>
              <button onClick={() => handleNavigate('services')} className="text-button-animate text-[#D32323] text-sm">
                Learn more →
              </button>
            </div>

            {/* Removals */}
            <div className="surface-card p-6">
              <div className="bg-[#FEF2F2] w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Home className="h-6 w-6 text-[#D32323]" />
              </div>
              <h3 className="mb-3">Removals</h3>
              <p className="text-gray-600 text-sm mb-4">
                Residential and commercial removals with safe handling of furniture, equipment, and goods. Professional service you can trust.
              </p>
              <button onClick={() => handleNavigate('services')} className="text-button-animate text-[#D32323] text-sm">
                Learn more →
              </button>
            </div>

            {/* Commercial Transport */}
            <div className="surface-card p-6">
              <div className="bg-[#FEF2F2] w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-[#D32323]" />
              </div>
              <h3 className="mb-3">Commercial Transport</h3>
              <p className="text-gray-600 text-sm mb-4">
                Flexible transport solutions for businesses. One-off deliveries or ongoing contracts, we match the right vehicle to your needs.
              </p>
              <button onClick={() => handleNavigate('services')} className="text-button-animate text-[#D32323] text-sm">
                Learn more →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Fleet Overview */}
      <section className="py-16 bg-white scroll-reveal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="mb-4">Our Fleet</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Our company-owned fleet includes a wide range of vehicles to handle any transport requirement, from small parcels to heavy commercial loads.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="surface-card bg-gray-50 p-6 text-center">
              <h3 className="mb-2">Vans</h3>
              <p className="text-gray-600 text-sm">Small to large cargo vans for flexible delivery solutions</p>
            </div>
            <div className="surface-card bg-gray-50 p-6 text-center">
              <h3 className="mb-2">Flatbeds</h3>
              <p className="text-gray-600 text-sm">Open platform trucks for oversized and irregular loads</p>
            </div>
            <div className="surface-card bg-gray-50 p-6 text-center">
              <h3 className="mb-2">Curtainsiders</h3>
              <p className="text-gray-600 text-sm">Side-loading capability for efficient freight handling</p>
            </div>
            <div className="surface-card bg-gray-50 p-6 text-center">
              <h3 className="mb-2">Pantechs</h3>
              <p className="text-gray-600 text-sm">6–14 tonne capacity for substantial commercial freight</p>
            </div>
          </div>
          <div className="text-center mt-8">
            <button onClick={() => handleNavigate('fleet')} className="interactive-button bg-[#D32323] text-white px-8 py-3 rounded hover:bg-[#B01E1E]">
              View Full Fleet
            </button>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 bg-gray-900 text-white scroll-reveal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-center mb-12 text-white">Why Choose Transline Logistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="flex flex-col items-center text-center">
              <div className="bg-[#D32323] w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
              <h3 className="mb-2 text-white">Company-Owned Fleet</h3>
              <p className="text-gray-300 text-sm">
                All vehicles maintained to the highest standards for reliable service
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="bg-[#D32323] w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <Truck className="h-8 w-8 text-white" />
              </div>
              <h3 className="mb-2 text-white">Flexible Solutions</h3>
              <p className="text-gray-300 text-sm">
                Right vehicle for every job, from small parcels to heavy freight
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="bg-[#D32323] w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <Clock className="h-8 w-8 text-white" />
              </div>
              <h3 className="mb-2 text-white">On-Time Delivery</h3>
              <p className="text-gray-300 text-sm">
                Reliable and punctual service to keep your business moving
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="bg-[#D32323] w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <h3 className="mb-2 text-white">Safe & Secure</h3>
              <p className="text-gray-300 text-sm">
                Professional handling and care for all your goods
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-[#D32323] text-white scroll-reveal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="mb-4 text-white">Ready to Get Started?</h2>
          <p className="text-xl text-red-100 mb-8 max-w-2xl mx-auto">
            Contact us today for a fast quote on your freight, courier, or removals needs.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button onClick={() => handleNavigate('quote')} className="interactive-button bg-white text-[#D32323] px-8 py-3 rounded hover:bg-gray-100">
              Get a Quote
            </button>
            <button
              onClick={() => handleNavigate('contact')}
              className="interactive-button border-2 border-white text-white px-8 py-3 rounded hover:bg-[#B01E1E]"
            >
              Contact Us
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
