import logo from '../assets/transline-logo-lockup.png';

export function Footer() {
  return (
    <footer className="siteFooter">
      <div className="siteFooter__brand">
        <img src={logo} alt="Transline Logistics" width="1016" height="271" />
        <p>Freight, courier and removals from Perth across Western Australia.</p>
      </div>
      <div>
        <span className="eyebrow">Dispatch</span>
        <a href="tel:+61466582734">0466 582 734</a>
        <a href="mailto:admin@translinelogistics.org">admin@translinelogistics.org</a>
      </div>
      <div>
        <span className="eyebrow">Depot</span>
        <p>Perth, Western Australia</p>
        <a href="mailto:admin@translinelogistics.org?subject=Driver%20application">Drive with Transline →</a>
      </div>
      <div className="siteFooter__legal">
        <span>© {new Date().getFullYear()} Transline Logistics</span>
        <span>NHVAS · Chain of Responsibility</span>
      </div>
    </footer>
  );
}
