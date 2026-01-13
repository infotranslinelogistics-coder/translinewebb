import { Truck, Package, Home, Building2, CheckCircle } from 'lucide-react';

export function ServicesPage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gray-900 text-white py-20 scroll-reveal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-white mb-4">Our Services</h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Comprehensive transport and logistics solutions tailored to your needs, delivered with professionalism and reliability.
          </p>
        </div>
      </section>

      {/* Services */}
      <section className="py-16 scroll-reveal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          {/* Freight Delivery */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center scroll-reveal">
            <div>
              <div className="bg-[#FEF2F2] w-16 h-16 rounded-lg flex items-center justify-center mb-6">
                <Truck className="h-8 w-8 text-[#D32323]" />
              </div>
              <h2 className="mb-4">Freight Delivery</h2>
              <p className="text-gray-600 mb-6">
                Our freight delivery service provides reliable local and regional transport solutions for businesses of all sizes. We specialise in the safe and efficient movement of goods across Perth metro and regional areas.
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-[#D32323] flex-shrink-0 mt-0.5" />
                  <p className="text-gray-600">Palletised freight transport with secure handling</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-[#D32323] flex-shrink-0 mt-0.5" />
                  <p className="text-gray-600">Bulk goods delivery for large-scale requirements</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-[#D32323] flex-shrink-0 mt-0.5" />
                  <p className="text-gray-600">General freight suitable for a wide range of goods</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-[#D32323] flex-shrink-0 mt-0.5" />
                  <p className="text-gray-600">Flexible scheduling for one-off or regular deliveries</p>
                </div>
              </div>
            </div>
            <div
              className="h-96 bg-cover bg-center rounded-lg"
              style={{
                backgroundImage: 'url(https://images.unsplash.com/photo-1764046155497-ad7e50737ffa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3YXJlaG91c2UlMjBwYWxsZXRzfGVufDF8fHx8MTc2NzQ1MTY1MXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral)',
              }}
            ></div>
          </div>

          {/* Courier Services */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center scroll-reveal">
            <div
              className="h-96 bg-cover bg-center rounded-lg order-2 lg:order-1"
              style={{
                backgroundImage: 'url(https://images.unsplash.com/photo-1762135995921-fedb142e7b96?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZWxpdmVyeSUyMHZhbiUyMGxvZ2lzdGljc3xlbnwxfHx8fDE3Njc0NTE2NTF8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral)',
              }}
            ></div>
            <div className="order-1 lg:order-2">
              <div className="bg-[#FEF2F2] w-16 h-16 rounded-lg flex items-center justify-center mb-6">
                <Package className="h-8 w-8 text-[#D32323]" />
              </div>
              <h2 className="mb-4">Courier Services</h2>
              <p className="text-gray-600 mb-6">
                When time is critical, our courier service delivers. We provide fast, secure, and professional courier solutions for parcels, documents, and time-sensitive items.
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-[#D32323] flex-shrink-0 mt-0.5" />
                  <p className="text-gray-600">Same-day and express delivery options available</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-[#D32323] flex-shrink-0 mt-0.5" />
                  <p className="text-gray-600">Secure handling of documents and parcels</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-[#D32323] flex-shrink-0 mt-0.5" />
                  <p className="text-gray-600">Perth metro and regional coverage</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-[#D32323] flex-shrink-0 mt-0.5" />
                  <p className="text-gray-600">Proof of delivery and tracking available</p>
                </div>
              </div>
            </div>
          </div>

          {/* Removals */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center scroll-reveal">
            <div>
              <div className="bg-[#FEF2F2] w-16 h-16 rounded-lg flex items-center justify-center mb-6">
                <Home className="h-8 w-8 text-[#D32323]" />
              </div>
              <h2 className="mb-4">Removals</h2>
              <p className="text-gray-600 mb-6">
                Whether you're moving house or relocating your business, our removals service ensures your furniture, equipment, and goods are transported safely and efficiently.
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-[#D32323] flex-shrink-0 mt-0.5" />
                  <p className="text-gray-600">Residential removals for homes and apartments</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-[#D32323] flex-shrink-0 mt-0.5" />
                  <p className="text-gray-600">Commercial removals for offices and businesses</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-[#D32323] flex-shrink-0 mt-0.5" />
                  <p className="text-gray-600">Professional handling of furniture and fragile items</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-[#D32323] flex-shrink-0 mt-0.5" />
                  <p className="text-gray-600">Flexible booking to suit your schedule</p>
                </div>
              </div>
            </div>
            <div
              className="h-96 bg-cover bg-center rounded-lg"
              style={{
                backgroundImage: 'url(https://images.unsplash.com/photo-1703977883249-d959f2b0c1ae?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXJnbyUyMHRyYW5zcG9ydHxlbnwxfHx8fDE3Njc0NTE2NTJ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral)',
              }}
            ></div>
          </div>

          {/* Fleet Transport Solutions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center scroll-reveal">
            <div
              className="h-96 bg-cover bg-center rounded-lg order-2 lg:order-1"
              style={{
                backgroundImage: 'url(https://images.unsplash.com/photo-1766608422198-5be9ac0aac9e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVpZ2h0JTIwdHJ1Y2slMjBoaWdod2F5fGVufDF8fHx8MTc2NzQ1MTY1MXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral)',
              }}
            ></div>
            <div className="order-1 lg:order-2">
              <div className="bg-[#FEF2F2] w-16 h-16 rounded-lg flex items-center justify-center mb-6">
                <Building2 className="h-8 w-8 text-[#D32323]" />
              </div>
              <h2 className="mb-4">Fleet Transport Solutions</h2>
              <p className="text-gray-600 mb-6">
                Our comprehensive fleet allows us to match the right vehicle to every job. From small vans to 14-tonne pantechs, we have the capacity and capability to handle your transport requirements.
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-[#D32323] flex-shrink-0 mt-0.5" />
                  <p className="text-gray-600">Small loads handled by compact vans</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-[#D32323] flex-shrink-0 mt-0.5" />
                  <p className="text-gray-600">Medium freight transported in curtainsiders and flatbeds</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-[#D32323] flex-shrink-0 mt-0.5" />
                  <p className="text-gray-600">Heavy commercial loads up to 14 tonnes in pantechs</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-[#D32323] flex-shrink-0 mt-0.5" />
                  <p className="text-gray-600">Cost-effective solutions tailored to your budget</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gray-50 scroll-reveal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="mb-4">Need a Transport Solution?</h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Get in touch with our team to discuss your requirements and receive a competitive quote.
          </p>
          <button className="interactive-button bg-[#D32323] text-white px-8 py-3 rounded hover:bg-[#B01E1E]">
            Request a Quote
          </button>
        </div>
      </section>
    </div>
  );
}
