import { FormEvent, useMemo, useState } from 'react';
import { ArrowDown, ArrowRight, Check, Clock3, MapPin, PackageCheck, Truck } from 'lucide-react';
import { RouteMap, freightRoutes, type ServiceType } from './RouteMap';

const services = [
  { number: '01', name: 'General freight', stat: 'Up to 14 t', copy: 'Pallets, equipment and commercial freight matched to the right vehicle.' },
  { number: '02', name: 'Courier', stat: 'Same-day metro', copy: 'Time-critical parcels and documents across Perth, booked direct with dispatch.' },
  { number: '03', name: 'Oversize', stat: 'Flatbed ready', copy: 'Irregular loads moved with clear dimensions, restraints and site access confirmed.' },
  { number: '04', name: 'Removals', stat: 'Home + commercial', copy: 'Pantech capacity for office, warehouse and residential moves.' },
];

const fleet = [
  ['Cargo vans', 'Metro courier', 'Small consignments', 'Fast access'],
  ['Flatbeds', 'Oversize freight', 'Open deck', 'Forklift access'],
  ['Curtainsiders', 'Pallet freight', 'Side loading', 'Weather covered'],
  ['Pantechs', 'Commercial loads', '6–14 tonnes', 'Enclosed body'],
];

const process = [
  ['Book', 'Give dispatch the load, pickup window and site conditions.'],
  ['Pickup', 'The assigned driver confirms collection and load restraint.'],
  ['Track', 'Status and location events stay tied to the shipment.'],
  ['Deliver', 'Proof of delivery closes the job and reaches your account.'],
];

export function HomePage() {
  const [service, setService] = useState<ServiceType | 'all'>('all');
  const [quoteSent, setQuoteSent] = useState(false);
  const routeCount = useMemo(() => service === 'all' ? freightRoutes.length : freightRoutes.filter((route) => route.service === service).length, [service]);

  const handleQuote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQuoteSent(true);
    event.currentTarget.reset();
  };

  return (
    <>
      <section id="top" className="heroSection">
        <div className="heroSection__copy">
          <span className="eyebrow">Perth dispatch · Western Australia</span>
          <h1><span>Freight</span><span>moves.</span><em>Perth works.</em></h1>
          <p>Company-owned vehicles from cargo vans to 14-tonne pantechs. Book direct. Know the driver. Track the load.</p>
          <div className="heroSection__actions">
            <a className="button button--primary" href="#quote">Book freight <ArrowRight /></a>
            <a className="button button--line" href="#coverage">See coverage <ArrowDown /></a>
          </div>
        </div>
        <div className="heroSection__map">
          <RouteMap variant="hero" />
        </div>
        <div className="dispatchTicker" aria-label="Current dispatch status">
          <span className="dispatchTicker__pulse" />
          <strong>Dispatch online</strong>
          <span>Perth metro + regional WA bookings open</span>
          <span className="data-value">0466 582 734</span>
        </div>
      </section>

      <section id="services" className="lightSection sectionShell">
        <div className="sectionIntro">
          <span className="eyebrow">What we move</span>
          <h2>Right truck.<br />Clear job.</h2>
          <p>No vague promises. Tell us the dimensions, timing and site access. Dispatch assigns the vehicle that fits.</p>
        </div>
        <div className="serviceGrid">
          {services.map((item) => (
            <article key={item.number} className="serviceItem">
              <div className="serviceItem__top"><span className="data-value">{item.number}</span><ArrowRight /></div>
              <h3>{item.name}</h3>
              <strong className="data-value">{item.stat}</strong>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="coverage" className="darkSection sectionShell coverageSection">
        <div className="sectionIntro sectionIntro--dark">
          <span className="eyebrow">Coverage board</span>
          <h2>WA first.<br />Interstate on request.</h2>
          <p>Select a freight type, then choose a hub on the map to see its corridor, distance and expected transit.</p>
          <div className="routeFilters" aria-label="Filter routes by freight type">
            {(['all', 'general', 'express', 'refrigerated', 'heavy'] as const).map((item) => (
              <button key={item} type="button" className={service === item ? 'is-active' : ''} onClick={() => setService(item)} aria-pressed={service === item}>{item}</button>
            ))}
          </div>
          <p className="coverageSection__count data-value">{routeCount} corridors shown</p>
        </div>
        <RouteMap variant="tracking" service={service} />
      </section>

      <section id="fleet" className="lightSection sectionShell fleetSection">
        <div className="sectionIntro">
          <span className="eyebrow">Fleet composition</span>
          <h2>Four vehicle classes.<br />One dispatch desk.</h2>
        </div>
        <div className="fleetTable" role="table" aria-label="Fleet capability">
          <div className="fleetTable__header" role="row"><span>Vehicle</span><span>Best for</span><span>Capacity</span><span>Access</span></div>
          {fleet.map((row, index) => (
            <div className="fleetTable__row" role="row" key={row[0]}>
              <span><b className="data-value">0{index + 1}</b>{row[0]}</span>
              <span>{row[1]}</span><span className="data-value">{row[2]}</span><span>{row[3]}</span>
            </div>
          ))}
        </div>
        <p className="fleetSection__note">Fleet counts and exact payloads remain subject to vehicle and route. Dispatch confirms capacity before booking.</p>
      </section>

      <section className="processSection sectionShell">
        <div className="sectionIntro sectionIntro--dark">
          <span className="eyebrow">How it works</span>
          <h2>Four handoffs.<br />No guessing.</h2>
        </div>
        <ol className="processGrid">
          {process.map(([title, copy], index) => (
            <li key={title}><span className="data-value">0{index + 1}</span><div><h3>{title}</h3><p>{copy}</p></div></li>
          ))}
        </ol>
      </section>

      <section id="track" className="trackSection sectionShell">
        <div>
          <span className="eyebrow">Admin portal</span>
          <h2>Track every driver.</h2>
        </div>
        <div className="adminPortalCallout">
          <p>Authorised Transline staff can view driver locations, assigned vehicles, active shifts and route history from one operations screen.</p>
          <a className="button button--light" href="/portal/login">Open admin portal <ArrowRight /></a>
        </div>
      </section>

      <section id="quote" className="quoteSection sectionShell">
        <div className="sectionIntro sectionIntro--dark">
          <span className="eyebrow">Get a quote</span>
          <h2>Load. Route.<br />Pickup window.</h2>
          <p>That is enough to start. Dispatch will call if access, restraint or timing needs more detail.</p>
          <div className="quoteFacts">
            <span><Clock3 /> Direct dispatch response</span>
            <span><MapPin /> Perth metro + regional WA</span>
            <span><Truck /> Vehicle matched to load</span>
          </div>
        </div>
        {quoteSent ? (
          <div className="quoteSuccess" role="status"><Check /><h3>Request logged.</h3><p>Dispatch will confirm the job details using the contact provided.</p><button type="button" onClick={() => setQuoteSent(false)}>Send another request</button></div>
        ) : (
          <form className="quoteForm" onSubmit={handleQuote}>
            <label>Name<input name="name" required autoComplete="name" /></label>
            <label>Phone or email<input name="contact" required autoComplete="email" /></label>
            <label>Pickup → destination<input name="route" required placeholder="Welshpool → Geraldton" /></label>
            <label>What are we moving?<textarea name="load" required rows={3} placeholder="2 pallets, 1.8 t, forklift both ends" /></label>
            <button className="button button--primary" type="submit">Request quote <ArrowRight /></button>
          </form>
        )}
      </section>

      <section id="about" className="aboutSection sectionShell">
        <div className="sectionIntro">
          <span className="eyebrow">Operations</span>
          <h2>Built for the work.</h2>
          <p>Transline runs freight, courier and removals from Perth with a company-owned fleet and one accountable dispatch line.</p>
        </div>
        <div className="factGrid">
          <div><strong className="data-value">100%</strong><span>Company-owned fleet</span></div>
          <div><strong className="data-value">14 t</strong><span>Top listed pantech capacity</span></div>
          <div><strong className="data-value">4</strong><span>Vehicle classes</span></div>
          <div><PackageCheck /><span>NHVAS + Chain of Responsibility</span></div>
        </div>
      </section>
    </>
  );
}
