import { Plus, Minus } from 'lucide-react';
import { useState } from 'react';

interface FaqItem {
  question: string;
  answer: string;
}

const faqs: FaqItem[] = [
  {
    question: 'What areas do you service?',
    answer: 'We provide transport services across Perth metro and regional Western Australia. Our fleet operates throughout the greater Perth area and regional WA centres, with regular routes covering key freight corridors. Contact us to confirm service availability for your specific pickup and delivery locations.',
  },
  {
    question: 'What types of goods do you transport?',
    answer: 'We transport a wide range of goods including palletised freight, bulk materials, parcels, documents, furniture, commercial equipment, machinery, building supplies, and general cargo. If you have specific items or materials requiring transport, contact us to discuss your requirements and confirm suitability.',
  },
  {
    question: 'Do you handle both small and large deliveries?',
    answer: 'Yes. Our diverse fleet allows us to handle everything from small parcel courier deliveries to heavy commercial freight up to 14 tonnes. We match the appropriate vehicle to your load size, ensuring cost-effective and efficient transport regardless of scale.',
  },
  {
    question: 'Can you help with removals?',
    answer: 'Absolutely. We provide both residential and commercial removals services. Our team handles furniture, equipment, and goods with professional care. Whether you\'re moving house, relocating an office, or transporting commercial assets, we have the vehicles and experience to manage your move.',
  },
  {
    question: 'How do I get a quote?',
    answer: 'You can request a quote by calling us on 0466582734, emailing admin@translinelogistics.org, or filling out the quote request form on our website. Please provide details including pickup and delivery locations, load description, approximate size/weight, and preferred timing for the most accurate quote.',
  },
  {
    question: 'Do you provide one-off and ongoing transport services?',
    answer: 'Yes, we cater to both one-off deliveries and ongoing transport contracts. Whether you need a single urgent delivery or regular scheduled transport for your business, we can tailor our services to suit your requirements and frequency.',
  },
  {
    question: 'What vehicle sizes do you have available?',
    answer: 'Our company-owned fleet includes small to large cargo vans, flatbed trucks, curtainsider vehicles, and pantechs ranging from 6 to 14 tonnes. This variety ensures we can match the right vehicle to your specific transport needs, whether it\'s a small parcel or substantial commercial freight.',
  },
  {
    question: 'Are your vehicles company-owned or subcontracted?',
    answer: 'All vehicles in our fleet are company-owned and maintained. This ensures consistent quality, reliability, and accountability. We don\'t rely on subcontractors, giving you confidence that your goods are handled by our experienced team using well-maintained equipment.',
  },
  {
    question: 'What are your operating hours?',
    answer: 'Our operating hours are Monday to Friday 7am–6pm, and Saturday 8am–12pm. We are closed on Sundays. However, we can arrange special transport requirements outside these hours on a case-by-case basis—contact us to discuss your specific needs.',
  },
  {
    question: 'Do you offer same-day or express delivery?',
    answer: 'Yes, same-day and express delivery options are available for courier services and urgent freight, subject to availability and location. Contact us as early as possible with your requirements, and we\'ll do our best to accommodate tight timeframes.',
  },
  {
    question: 'How do I track my delivery?',
    answer: 'For courier and freight deliveries, we provide tracking updates and proof of delivery. When you book with us, you\'ll receive information on how to track your shipment. For specific queries about your delivery status, contact our team directly.',
  },
  {
    question: 'What if my goods are damaged during transport?',
    answer: 'We take every precaution to ensure goods are transported safely. All our vehicles are maintained to high standards, and our team is trained in proper handling and securing of loads. In the unlikely event of damage, please contact us immediately so we can investigate and resolve the matter.',
  },
];

export function FaqPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gray-900 text-white py-20 scroll-reveal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-white mb-4">Frequently Asked Questions</h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Find answers to common questions about our transport services, fleet, and booking process.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 scroll-reveal">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="surface-card">
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
                >
                  <h3 className="pr-8">{faq.question}</h3>
                  {openIndex === index ? (
                    <Minus className="h-5 w-5 text-[#D32323] flex-shrink-0" />
                  ) : (
                    <Plus className="h-5 w-5 text-[#D32323] flex-shrink-0" />
                  )}
                </button>
                {openIndex === index && (
                  <div className="px-6 pb-6">
                    <p className="text-gray-600">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Still Have Questions Section */}
      <section className="py-16 bg-gray-50 scroll-reveal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="mb-4">Still Have Questions?</h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            If you can't find the answer you're looking for, our team is here to help. Get in touch and we'll provide the information you need.
          </p>
          <button className="interactive-button bg-[#D32323] text-white px-8 py-3 rounded hover:bg-[#B01E1E]">
            Contact Us
          </button>
        </div>
      </section>
    </div>
  );
}
