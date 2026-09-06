import { ArrowRight, ArrowDown, Truck, MoveUpRight } from 'lucide-react';
import { RouteMap } from './RouteMap';
import { services } from '../site/catalog';

export function HomePage() {
  return <>
    <section className="heroSection" id="top">
      <div className="heroSection__copy">
        <span className="eyebrow heroEnter">Perth, Western Australia / Transport + logistics</span>
        <h1 className="heroEnter"><span>Built</span><span>to move<span className="heroFullStop">.</span></span></h1>
        <p className="heroEnter">Big load. Tight window. Next suburb or further out.<br className="desktopBreak" /> We put the right vehicle on the job.</p>
        <div className="heroSection__actions heroEnter"><a className="button button--primary" href="/quote">Let’s move it <ArrowRight /></a><a className="button button--line" href="/freight">Explore freight <ArrowDown /></a></div>
        <div className="heroCoordinates data-value">31.9523° S &nbsp; 115.8613° E <span>Perth operations</span></div>
      </div>
      <div className="heroSection__map"><RouteMap variant="hero" /></div>
      <div className="dispatchTicker"><span className="dispatchTicker__pulse" /><strong>Direct to dispatch</strong><span>Freight · Courier · Removals</span><a className="data-value" href="tel:+61466582734">0466 582 734 ↗</a></div>
    </section>
    <div className="typeRibbon" aria-hidden="true"><div>{Array.from({ length: 4 }, (_, i) => <span key={i}>LOAD IT. <b>MOVE IT.</b> DELIVER IT. <MoveUpRight /></span>)}</div></div>
    <section className="lightSection sectionShell">
      <div className="sectionIntro"><span className="eyebrow">01 / What we move</span><h2>Freight with<br />a clear plan.</h2><p>From the first call to the final unload, dispatch works with the details that matter: the load, the vehicle and the access.</p><a className="textLink" href="/freight">All freight services <ArrowRight /></a></div>
      <div className="serviceGrid">{services.map((service, i) => <a className="serviceItem" key={service.slug} href={`/freight/${service.slug}`}><div className="serviceItem__top"><span className="data-value">0{i + 1}</span><MoveUpRight /></div><h3>{service.name}</h3><strong>{service.tag}</strong><p>{service.body}</p></a>)}</div>
    </section>
    <section className="darkSection sectionShell coverageSection"><div className="sectionIntro sectionIntro--dark"><span className="eyebrow">02 / On the map</span><h2>Real places.<br />Real work.</h2><p>Our work starts in Perth. Discuss your pickup and destination with dispatch, and explore past delivery locations as they are added to the map.</p><a className="textLink" href="/coverage">Explore delivery points <ArrowRight /></a><a className="textLink" href="/locations">Find a WA town or postcode <ArrowRight /></a></div><RouteMap variant="tracking" theme="dark" /></section>
    <section className="fleetTeaser"><div><span className="eyebrow">03 / The equipment</span><h2>Small parcel.<br /><span>Serious capacity.</span></h2></div><div className="fleetTeaser__body"><Truck size={52} strokeWidth={1} /><p>Cargo vans, flatbeds, curtainsiders and pantechs. Company-owned vehicles selected around the work.</p><a className="button button--light" href="/fleet">Meet the fleet <ArrowRight /></a></div></section>
    <section className="processSection sectionShell"><div className="sectionIntro sectionIntro--dark"><span className="eyebrow">04 / How we work</span><h2>Four steps.<br />One dispatch desk.</h2></div><ol className="processGrid">{[['Tell us the load', 'Send the item list, weight, dimensions and both locations.'], ['Confirm the plan', 'Dispatch checks the vehicle, timing and loading access.'], ['Get it moving', 'The assigned driver collects the load and dispatch handles delivery enquiries.'], ['Complete the job', 'The delivery handoff is confirmed against the agreed booking.']].map(([title, body], i) => <li key={title}><span className="data-value">0{i + 1}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol></section>
    <section className="closingCta"><span className="eyebrow">Have something to move?</span><a href="/quote">Let’s get<br />to work.<MoveUpRight /></a><p>Tell dispatch the load and the destination. We’ll take it from there.</p></section>
  </>;
}
