import { Clock, Mail, MapPin, Phone } from 'lucide-react';

export function ContactPage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gray-900 text-white py-20 scroll-reveal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-white mb-4">Contact Us</h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Get in touch for quotes, bookings, or general enquiries. We're here to help with all your transport needs.
          </p>
        </div>
      </section>

      {/* Contact Information & Form */}
      <section className="py-16 scroll-reveal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Contact Information */}
            <div className="lg:col-span-1 space-y-8">
              <div>
                <h2 className="mb-6">Get in Touch</h2>
                <p className="text-gray-600 mb-8">
                  Contact us today for a fast response. Whether you need a quote, want to make a booking, or have questions about our services, our team is ready to assist.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="bg-[#FEF2F2] w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Phone className="h-6 w-6 text-[#D32323]" />
                  </div>
                  <div>
                    <h3 className="mb-1">Phone</h3>
                    <p className="text-gray-600">0466582734</p>
                    <p className="text-gray-600">Mon–Fri: 7am–6pm</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-[#FEF2F2] w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail className="h-6 w-6 text-[#D32323]" />
                  </div>
                  <div>
                    <h3 className="mb-1">Email</h3>
                    <p className="text-gray-600">admin@translinelogistics.org</p>
                    <p className="text-gray-500 text-sm">We respond within 2 business hours</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-[#FEF2F2] w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-6 w-6 text-[#D32323]" />
                  </div>
                  <div>
                    <h3 className="mb-1">Service Area</h3>
                    <p className="text-gray-600">Perth metro and regional WA</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-[#FEF2F2] w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Clock className="h-6 w-6 text-[#D32323]" />
                  </div>
                  <div>
                    <h3 className="mb-1">Operating Hours</h3>
                    <p className="text-gray-600">Monday–Friday: 7am–6pm</p>
                    <p className="text-gray-600">Saturday: 8am–12pm</p>
                    <p className="text-gray-600">Sunday: Closed</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <div className="surface-card p-8">
                <h2 className="mb-6">Send Us a Message</h2>
                <form
                  name="contact"
                  method="POST"
                  data-netlify="true"
                  data-netlify-honeypot="bot-field"
                  className="space-y-6"
                >
                  <input type="hidden" name="form-name" value="contact" />
                  <div className="hidden">
                    <label>
                      Don’t fill this out if you're human: <input name="bot-field" />
                    </label>
                  </div>
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
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        <option value="other">Other / General Enquiry</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="message" className="block mb-2 text-gray-700">
                      Message *
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      required
                      rows={6}
                      placeholder="Please provide details about your transport requirements, including pickup and delivery locations, load size, and preferred timing..."
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#D32323]"
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    className="interactive-button w-full bg-[#D32323] text-white px-8 py-3 rounded hover:bg-[#B01E1E]"
                  >
                    Send Message
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Fast Response Section */}
      <section className="py-16 bg-gray-50 scroll-reveal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="mb-4">Fast Response Times</h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8">
            We understand that time matters in logistics. Our team aims to respond to all enquiries within 2 business hours during operating hours. For urgent transport requirements, please call us directly.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div>
              <div className="text-[#D32323] mb-2">2 Hours</div>
              <p className="text-gray-600 text-sm">Average email response time</p>
            </div>
            <div>
              <div className="text-[#D32323] mb-2">Same Day</div>
              <p className="text-gray-600 text-sm">Quote turnaround available</p>
            </div>
            <div>
              <div className="text-[#D32323] mb-2">Immediate</div>
              <p className="text-gray-600 text-sm">Phone enquiries answered</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
