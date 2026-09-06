import { useState, type FormEvent } from 'react';
import { ArrowRight, CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react';
import { services } from './catalog';

type SubmissionState = 'idle' | 'submitting' | 'success' | 'error';

export function QuoteForm({ destination = '', service = '' }: { destination?: string; service?: string }) {
  const [status, setStatus] = useState<SubmissionState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function submitEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus('submitting');
    setErrorMessage('');

    try {
      const response = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: window.crypto.randomUUID(),
          name: data.get('name'),
          contact: data.get('contact'),
          service: data.get('service'),
          pickup: data.get('pickup'),
          destination: data.get('destination'),
          loadDetails: data.get('loadDetails'),
          preferredDate: data.get('preferredDate'),
          website: data.get('website'),
          sourcePath: typeof window === 'undefined' ? '' : window.location.pathname,
        }),
      });
      const result = await response.json().catch(() => null) as { error?: string; message?: string } | null;
      if (!response.ok) throw new Error(result?.message || result?.error || 'We could not send your enquiry.');

      form.reset();
      setStatus('success');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'We could not send your enquiry.');
      setStatus('error');
    }
  }

  function editForm() {
    if (status === 'success' || status === 'error') {
      setStatus('idle');
      setErrorMessage('');
    }
  }

  return <form className="enquiryForm" onSubmit={submitEnquiry} onChange={editForm}>
    <label>Name<input name="name" autoComplete="name" required minLength={2} maxLength={120} /></label>
    <label>Phone or email<input name="contact" autoComplete="email" required minLength={3} maxLength={160} /></label>
    <label>Service<select name="service" defaultValue={service} required><option value="" disabled>Select a service</option>{services.map(item => <option value={item.slug} key={item.slug}>{item.name}</option>)}</select></label>
    <label>Pickup town or suburb<input name="pickup" autoComplete="address-level2" required minLength={2} maxLength={160} /></label>
    <label className="enquiryForm__wide">Destination<input name="destination" defaultValue={destination} autoComplete="address-level2" required minLength={2} maxLength={160} /></label>
    <label className="enquiryForm__wide">Load details<textarea name="loadDetails" rows={4} required minLength={10} maxLength={2000} placeholder="Items, dimensions, total weight and loading access" /></label>
    <label className="enquiryForm__wide">Preferred date or window<input name="preferredDate" maxLength={120} placeholder="Date and preferred pickup window" /></label>
    <label className="enquiryForm__trap" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
    <button className="button button--primary" type="submit" disabled={status === 'submitting'}>
      {status === 'submitting' ? <>Sending <LoaderCircle className="enquiryForm__spinner" /></> : <>Send booking enquiry <ArrowRight /></>}
    </button>
    <p className="enquiryForm__note">Submitting this form emails Transline dispatch. A booking is confirmed only after dispatch accepts the job.</p>
    {status === 'success' && <div className="enquiryForm__status enquiryForm__status--success" role="status"><CircleCheck /><div><strong>Enquiry sent.</strong><p>Dispatch has received your details and will contact you about availability and the next step.</p></div></div>}
    {status === 'error' && <div className="enquiryForm__status enquiryForm__status--error" role="alert"><CircleAlert /><div><strong>Enquiry not sent.</strong><p>{errorMessage} Try again, call <a href="tel:+61466582734">0466 582 734</a>, or email <a href="mailto:admin@translinelogistics.org">admin@translinelogistics.org</a>.</p></div></div>}
  </form>;
}
