export function PrivacyPage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gray-900 text-white py-20 scroll-reveal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-white mb-4">Privacy Policy</h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Last updated: January 2026
          </p>
        </div>
      </section>

      {/* Privacy Content */}
      <section className="py-16 scroll-reveal">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div>
            <h2 className="mb-4">Introduction</h2>
            <p className="text-gray-600">
              Transline Logistics is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our transport and logistics services or visit our website.
            </p>
          </div>

          <div>
            <h2 className="mb-4">Information We Collect</h2>
            <p className="text-gray-600 mb-3">
              We may collect the following types of information:
            </p>
            <ul className="space-y-2 text-gray-600 ml-6">
              <li>• Personal identification information (name, email address, phone number)</li>
              <li>• Business information (company name, ABN, business address)</li>
              <li>• Pickup and delivery addresses</li>
              <li>• Details about goods being transported</li>
              <li>• Payment and billing information</li>
              <li>• Communication records (emails, phone calls, enquiries)</li>
            </ul>
          </div>

          <div>
            <h2 className="mb-4">How We Use Your Information</h2>
            <p className="text-gray-600 mb-3">
              We use the information we collect to:
            </p>
            <ul className="space-y-2 text-gray-600 ml-6">
              <li>• Provide and deliver our transport and logistics services</li>
              <li>• Process bookings and payments</li>
              <li>• Communicate with you about your bookings and enquiries</li>
              <li>• Send quotes, invoices, and service updates</li>
              <li>• Improve our services and customer experience</li>
              <li>• Comply with legal obligations and industry regulations</li>
              <li>• Prevent fraud and maintain security</li>
            </ul>
          </div>

          <div>
            <h2 className="mb-4">Disclosure of Your Information</h2>
            <p className="text-gray-600 mb-3">
              We may share your information with:
            </p>
            <ul className="space-y-2 text-gray-600 ml-6">
              <li>• Service providers who assist in operating our business (e.g., payment processors, IT support)</li>
              <li>• Regulatory authorities and law enforcement when required by law</li>
              <li>• Third parties with your consent</li>
            </ul>
            <p className="text-gray-600 mt-3">
              We do not sell, trade, or rent your personal information to third parties for marketing purposes.
            </p>
          </div>

          <div>
            <h2 className="mb-4">Data Security</h2>
            <p className="text-gray-600">
              We implement appropriate technical and organisational measures to protect your personal information against unauthorised access, alteration, disclosure, or destruction. However, no method of transmission over the internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
            </p>
          </div>

          <div>
            <h2 className="mb-4">Data Retention</h2>
            <p className="text-gray-600">
              We retain your personal information for as long as necessary to fulfil the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law.
            </p>
          </div>

          <div>
            <h2 className="mb-4">Your Rights</h2>
            <p className="text-gray-600 mb-3">
              Under Australian privacy law, you have the right to:
            </p>
            <ul className="space-y-2 text-gray-600 ml-6">
              <li>• Access the personal information we hold about you</li>
              <li>• Request correction of inaccurate or incomplete information</li>
              <li>• Request deletion of your personal information (subject to legal obligations)</li>
              <li>• Opt out of marketing communications</li>
              <li>• Lodge a complaint with the Office of the Australian Information Commissioner (OAIC)</li>
            </ul>
          </div>

          <div>
            <h2 className="mb-4">Cookies and Tracking</h2>
            <p className="text-gray-600">
              Our website may use cookies and similar tracking technologies to enhance your browsing experience. You can control cookie settings through your browser preferences.
            </p>
          </div>

          <div>
            <h2 className="mb-4">Third-Party Links</h2>
            <p className="text-gray-600">
              Our website may contain links to third-party websites. We are not responsible for the privacy practices of these external sites and encourage you to review their privacy policies.
            </p>
          </div>

          <div>
            <h2 className="mb-4">Changes to This Privacy Policy</h2>
            <p className="text-gray-600">
              We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated revision date. We encourage you to review this policy periodically.
            </p>
          </div>

          <div>
            <h2 className="mb-4">Contact Us</h2>
            <p className="text-gray-600 mb-3">
              If you have any questions about this Privacy Policy or wish to exercise your privacy rights, please contact us:
            </p>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="text-gray-600 mb-2">
                <span className="text-gray-900">Email:</span> admin@translinelogistics.org
            </p>
            <p className="text-gray-600">
                <span className="text-gray-900">Phone:</span> 0466582734
            </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
