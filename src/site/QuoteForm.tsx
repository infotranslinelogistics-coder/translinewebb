import { useState, type FormEvent } from 'react';
import { ArrowRight, Mail } from 'lucide-react';

export function QuoteForm({ destination = '' }: { destination?: string }) {
  const [email, setEmail] = useState('');
  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const message = ['Transport quote enquiry', '', ...['Name', 'Contact', 'Pickup', 'Destination', 'Load details', 'Preferred date'].map(key => `${key}: ${String(data.get(key) ?? '')}`)].join('\n');
    setEmail(`mailto:admin@translinelogistics.org?subject=${encodeURIComponent('Transport quote enquiry')}&body=${encodeURIComponent(message)}`);
  }
  return <form className="enquiryForm" onSubmit={prepare} onChange={() => setEmail('')}>
    <label>Name<input name="Name" autoComplete="name" required maxLength={120} /></label>
    <label>Phone or email<input name="Contact" required maxLength={160} /></label>
    <label>Pickup town or suburb<input name="Pickup" required maxLength={160} /></label>
    <label>Destination<input name="Destination" defaultValue={destination} required maxLength={160} /></label>
    <label className="enquiryForm__wide">Load details<textarea name="Load details" rows={3} required maxLength={2000} placeholder="Items, dimensions, total weight and loading access" /></label>
    <label className="enquiryForm__wide">Preferred date or window<input name="Preferred date" maxLength={120} placeholder="Date and preferred pickup window" /></label>
    <button className="button button--primary" type="submit">Prepare enquiry <ArrowRight /></button>
    <p className="enquiryForm__note">This prepares an email for you to send. A booking is confirmed only after dispatch accepts the job.</p>
    {email && <div className="enquiryForm__ready" role="status"><Mail /><div><strong>Your enquiry is ready.</strong><p>Open your email app, review the details and send to dispatch.</p><a className="button button--primary" href={email}>Open email to send <ArrowRight /></a></div></div>}
  </form>;
}
