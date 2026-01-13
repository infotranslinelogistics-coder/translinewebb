import { CheckCircle, Package, Truck } from 'lucide-react';

export function QuotePage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gray-900 text-white py-20 scroll-reveal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-white mb-4">Get a Quote</h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Request a competitive quote for your transport needs. Provide your details below and we'll respond within 2 business hours.
          </p>
        </div>
      </section>

      {/* Quote Form */}
      <section className="py-16 bg-gray-50 scroll-reveal">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="surface-card p-8">
            <form
              name="quote"
              method="POST"
              data-netlify="true"
              data-netlify-honeypot="bot-field"
              className="space-y-8"
            >
              <input type="hidden" name="form-name" value="quote" />
              <div className="hidden">
                <label>
                  Don’t fill this out if you're human: <input name="bot-field" />
                </label>
              </div>
              {/* Contact Information */}
              <div>
                <h2 className="mb-6">Contact Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block mb-2 text-gray-700">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#D32323]"
                    />
                  </div>
                  <div>
                    <label htmlFor="company" className="block mb-2 text-gray-700">
                      Company Name (if applicable)
                    </label>
                    <input
                      type="text"
                      id="company"
                      name="company"
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#D32323]"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block mb-2 text-gray-700">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#D32323]"
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block mb-2 text-gray-700">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#D32323]"
                    />
                  </div>
                </div>
              </div>

              {/* Service Details */}
              <div>
                <h2 className="mb-6">Service Details</h2>
                <div className="space-y-6">
                  <div>
                    <label htmlFor="service" className="block mb-2 text-gray-700">
                      Service Required *
                    </label>
                    <select
                      id="service"
                      name="service"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#D32323]"
                    >
                      <option value="">Select a service</option>
                      <option value="freight">Freight Delivery</option>
                      <option value="courier">Courier Services</option>
                      <option value="removals">Removals</option>
                      <option value="commercial">Commercial Transport</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="pickupLocation" className="block mb-2 text-gray-700">
                        Pickup Location *
                      </label>
                      <input
                        type="text"
                        id="pickupLocation"
                        name="pickupLocation"
                        required
                        placeholder="Suburb, postcode, or full address"
                        className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#D32323]"
                      />
                    </div>
                    <div>
                      <label htmlFor="deliveryLocation" className="block mb-2 text-gray-700">
                        Delivery Location *
                      </label>
                      <input
                        type="text"
                        id="deliveryLocation"
                        name="deliveryLocation"
                        required
                        placeholder="Suburb, postcode, or full address"
                        className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#D32323]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Load Information */}
              <div>
                <h2 className="mb-6">Load Information</h2>
                <div className="space-y-6">
                  <div>
                    <label htmlFor="loadDescription" className="block mb-2 text-gray-700">
                      Load Description *
                    </label>
                    <textarea
                      id="loadDescription"
                      name="loadDescription"
                      required
                      rows={3}
                      placeholder="Brief description of goods being transported"
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#D32323]"
                    ></textarea>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="weight" className="block mb-2 text-gray-700">
                        Approximate Weight
                      </label>
                      <input
                        type="text"
                        id="weight"
                        name="weight"
                        placeholder="e.g., 500kg, 2 tonnes"
                        className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#D32323]"
                      />
                    </div>
                    <div>
                      <label htmlFor="dimensions" className="block mb-2 text-gray-700">
                        Approximate Dimensions
                      </label>
                      <input
                        type="text"
                        id="dimensions"
                        name="dimensions"
                        placeholder="e.g., 2m x 1m x 1m"
                        className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#D32323]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Timing & Additional Information */}
              <div>
                <h2 className="mb-6">Timing & Additional Information</h2>
                <div className="space-y-6">
                  <div>
                    <label htmlFor="preferredDate" className="block mb-2 text-gray-700">
                      Preferred Pickup Date
                    </label>
                    <input
                      type="date"
                      id="preferredDate"
                      name="preferredDate"
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#D32323]"
                    />
                  </div>
                  <div>
                    <label htmlFor="additionalInfo" className="block mb-2 text-gray-700">
                      Additional Information
                    </label>
                    <textarea
                      id="additionalInfo"
                      name="additionalInfo"
                      rows={4}
                      placeholder="Any special requirements, access restrictions, or other relevant details..."
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#D32323]"
                    ></textarea>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="interactive-button w-full bg-[#D32323] text-white px-8 py-3 rounded hover:bg-[#B01E1E]"
              >
                Submit Quote Request
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Why Get a Quote Section */}
      <section className="py-16 bg-white scroll-reveal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-center mb-12">What to Expect</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-[#FEF2F2] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="h-8 w-8 text-[#D32323]" />
              </div>
              <h3 className="mb-2">Competitive Pricing</h3>
              <p className="text-gray-600 text-sm">
                Transparent, fair pricing based on your specific transport requirements
              </p>
            </div>
            <div className="text-center">
              <div className="bg-[#FEF2F2] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck className="h-8 w-8 text-[#D32323]" />
              </div>
              <h3 className="mb-2">Vehicle Recommendation</h3>
              <p className="text-gray-600 text-sm">
                We'll match the right vehicle from our fleet to your load
              </p>
            </div>
            <div className="text-center">
              <div className="bg-[#FEF2F2] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-[#D32323]" />
              </div>
              <h3 className="mb-2">Fast Response</h3>
              <p className="text-gray-600 text-sm">
                Quote delivered within 2 business hours during operating hours
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
