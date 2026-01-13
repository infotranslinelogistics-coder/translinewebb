import { Truck, Package, Container, Box } from 'lucide-react';

export function FleetPage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gray-900 text-white py-20 scroll-reveal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-white mb-4">Our Fleet</h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            A company-owned fleet designed to deliver flexibility, reliability, and capacity for every transport need.
          </p>
        </div>
      </section>

      {/* Fleet Introduction */}
      <section className="py-16 bg-white scroll-reveal">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-600 mb-4">
            At Transline Logistics, we maintain a diverse fleet of company-owned vehicles to ensure we can handle any transport requirement. From small courier parcels to heavy commercial freight, our fleet is equipped, maintained, and ready.
          </p>
          <p className="text-gray-600">
            All vehicles undergo regular servicing and safety checks, giving you confidence that your goods will arrive safely and on time.
          </p>
        </div>
      </section>

      {/* Fleet Vehicles */}
      <section className="py-16 bg-gray-50 scroll-reveal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {/* Vans */}
          <div className="surface-card p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <div className="bg-[#FEF2F2] w-16 h-16 rounded-lg flex items-center justify-center mb-4">
                  <Package className="h-8 w-8 text-[#D32323]" />
                </div>
                <h2 className="mb-2">Vans</h2>
                <p className="text-gray-500">Small to Large Capacity</p>
              </div>
              <div className="lg:col-span-2">
                <p className="text-gray-600 mb-4">
                  Our van fleet includes small, medium, and large cargo vans suitable for a wide range of delivery requirements. Perfect for courier services, small freight, and time-sensitive deliveries.
                </p>
                <h3 className="mb-2">Ideal For:</h3>
                <ul className="space-y-2 text-gray-600">
                  <li>• Parcel and document courier services</li>
                  <li>• Small to medium freight deliveries</li>
                  <li>• Residential moves and small removals</li>
                  <li>• Express and same-day deliveries</li>
                  <li>• Metro and regional courier runs</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Flatbeds */}
          <div className="surface-card p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <div className="bg-[#FEF2F2] w-16 h-16 rounded-lg flex items-center justify-center mb-4">
                  <Container className="h-8 w-8 text-[#D32323]" />
                </div>
                <h2 className="mb-2">Flatbeds</h2>
                <p className="text-gray-500">Open Platform Transport</p>
              </div>
              <div className="lg:col-span-2">
                <p className="text-gray-600 mb-4">
                  Flatbed trucks provide an open platform for oversized, irregular, or awkwardly shaped loads. With secure tie-down points and experienced handling, we transport goods that don't fit in enclosed vehicles.
                </p>
                <h3 className="mb-2">Ideal For:</h3>
                <ul className="space-y-2 text-gray-600">
                  <li>• Construction materials and equipment</li>
                  <li>• Oversized or irregular shaped items</li>
                  <li>• Machinery and plant equipment</li>
                  <li>• Steel, timber, and building supplies</li>
                  <li>• Loads requiring top or side loading</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Curtainsiders */}
          <div className="surface-card p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <div className="bg-[#FEF2F2] w-16 h-16 rounded-lg flex items-center justify-center mb-4">
                  <Box className="h-8 w-8 text-[#D32323]" />
                </div>
                <h2 className="mb-2">Curtainsiders</h2>
                <p className="text-gray-500">Side-Loading Capability</p>
              </div>
              <div className="lg:col-span-2">
                <p className="text-gray-600 mb-4">
                  Curtainsider vehicles offer the flexibility of side-loading access combined with weather protection. The retractable curtain sides allow for efficient loading and unloading from either side or the rear.
                </p>
                <h3 className="mb-2">Ideal For:</h3>
                <ul className="space-y-2 text-gray-600">
                  <li>• Palletised freight requiring side access</li>
                  <li>• Multiple drop-offs and collections</li>
                  <li>• General and bulk freight transport</li>
                  <li>• Weather-sensitive goods needing protection</li>
                  <li>• Efficient warehouse-to-warehouse transfers</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Pantechs */}
          <div className="surface-card p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <div className="bg-[#FEF2F2] w-16 h-16 rounded-lg flex items-center justify-center mb-4">
                  <Truck className="h-8 w-8 text-[#D32323]" />
                </div>
                <h2 className="mb-2">Pantechs (6–14 Tonne)</h2>
                <p className="text-gray-500">Heavy Commercial Freight</p>
              </div>
              <div className="lg:col-span-2">
                <p className="text-gray-600 mb-4">
                  Our pantech fleet ranges from 6 to 14 tonnes, providing substantial capacity for heavy commercial freight. Fully enclosed with rear roller doors or swing doors, these vehicles offer secure transport for larger loads.
                </p>
                <h3 className="mb-2">Ideal For:</h3>
                <ul className="space-y-2 text-gray-600">
                  <li>• Large commercial and industrial freight</li>
                  <li>• Full pallet loads and bulk deliveries</li>
                  <li>• Commercial removals and relocations</li>
                  <li>• Heavy equipment and machinery</li>
                  <li>• Interstate and regional freight transport</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Fleet Benefits */}
      <section className="py-16 bg-white scroll-reveal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-center mb-12">Fleet Advantages</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-[#FEF2F2] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck className="h-8 w-8 text-[#D32323]" />
              </div>
              <h3 className="mb-2">Company-Owned</h3>
              <p className="text-gray-600">
                All vehicles are owned and maintained by us, ensuring consistent quality and reliability
              </p>
            </div>
            <div className="text-center">
              <div className="bg-[#FEF2F2] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="h-8 w-8 text-[#D32323]" />
              </div>
              <h3 className="mb-2">Right Vehicle, Every Time</h3>
              <p className="text-gray-600">
                We match the appropriate vehicle to your load, maximising efficiency and cost-effectiveness
              </p>
            </div>
            <div className="text-center">
              <div className="bg-[#FEF2F2] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Container className="h-8 w-8 text-[#D32323]" />
              </div>
              <h3 className="mb-2">Regular Maintenance</h3>
              <p className="text-gray-600">
                Scheduled servicing and safety checks keep our fleet road-ready and reliable
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-[#D32323] text-white scroll-reveal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="mb-4 text-white">Not Sure Which Vehicle You Need?</h2>
          <p className="text-xl text-red-100 mb-8 max-w-2xl mx-auto">
            Contact our team and we'll recommend the best vehicle for your transport requirements.
          </p>
          <button className="interactive-button bg-white text-[#D32323] px-8 py-3 rounded hover:bg-gray-100">
            Get Expert Advice
          </button>
        </div>
      </section>
    </div>
  );
}
