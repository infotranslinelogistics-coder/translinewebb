import logo from '../assets/transline-logo-lockup.png';

export function Footer() {
  return (
    <footer className="siteFooter">
      <div className="siteFooter__brand">
        <img src={logo} alt="Transline Logistics" width="1016" height="271" />
        <p>Freight, hotshots, express delivery, courier and removals from Perth across Western Australia.</p>
        <a className="siteFooter__book" href="/quote">Book now →</a>
      </div>
      <div>
        <span className="eyebrow">Dispatch</span>
        <a href="tel:+61466582734">0466 582 734</a>
        <a href="mailto:admin@translinelogistics.org">admin@translinelogistics.org</a>
      </div>
      <div>
        <span className="eyebrow">Explore</span>
        <a href="/freight">Freight services</a>
        <a href="/freight/hotshots">Hotshots</a>
        <a href="/freight/express-delivery">Express delivery</a>
        <a href="/coverage">Past delivery points</a>
        <a href="/locations">WA location directory</a>
        <a href="/fleet">Our fleet</a>
        <a href="/about">About Transline</a>
      </div>
      <div>
        <span className="eyebrow">Perth operations</span>
        <p>Perth, Western Australia</p>
        <a href="/contact">Contact dispatch</a>
        <a href="/driver-tracking">Driver tracking</a>
        <a href="mailto:admin@translinelogistics.org?subject=Driver%20application">Drive with Transline →</a>
      </div>
      <div className="siteFooter__legal">
        <span>© {new Date().getFullYear()} Transline Logistics</span>
        <a href="/privacy">Privacy</a>
        <a href="/sitemap.xml">Sitemap</a>
      </div>
    </footer>
  );
}
