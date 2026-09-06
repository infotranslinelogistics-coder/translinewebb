import type { PageInfo } from './catalog';

export const DEFAULT_ORIGIN = 'https://translinewebb.vercel.app';
export function seoFor(page: PageInfo, origin = DEFAULT_ORIGIN) {
  const url = `${origin}${page.path === '/' ? '/' : page.path}`;
  const breadcrumbs = [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` }];
  if (page.path !== '/') {
    if (page.place) breadcrumbs.push({ '@type': 'ListItem', position: 2, name: 'Locations', item: `${origin}/locations` });
    else if (page.postcode) breadcrumbs.push({ '@type': 'ListItem', position: 2, name: 'Postcodes', item: `${origin}/postcodes` });
    else if (page.service) breadcrumbs.push({ '@type': 'ListItem', position: 2, name: 'Freight', item: `${origin}/freight` });
    breadcrumbs.push({ '@type': 'ListItem', position: breadcrumbs.length + 1, name: page.place?.name || page.postcode || page.heading, item: url });
  }
  const graph: Record<string, unknown>[] = [
    { '@type': 'Organization', '@id': `${origin}/#organization`, name: 'Transline Logistics', url: `${origin}/`, telephone: '+61466582734', email: 'admin@translinelogistics.org' },
    { '@type': 'WebSite', '@id': `${origin}/#website`, name: 'Transline Logistics', url: `${origin}/`, publisher: { '@id': `${origin}/#organization` }, inLanguage: 'en-AU' },
    { '@type': 'WebPage', '@id': url, name: page.title, description: page.description, url, isPartOf: { '@id': `${origin}/#website` }, inLanguage: 'en-AU', ...(page.place ? { mainEntity: { '@type': 'Place', name: page.place.name, address: { '@type': 'PostalAddress', addressLocality: page.place.name, addressRegion: 'WA', postalCode: page.place.postcode, addressCountry: 'AU' }, geo: { '@type': 'GeoCoordinates', latitude: page.place.lat, longitude: page.place.lng } } } : {}) },
    { '@type': 'BreadcrumbList', itemListElement: breadcrumbs },
  ];
  return { url, title: page.title, description: page.description, robots: page.index ? 'index,follow' : 'noindex,follow', structuredData: { '@context': 'https://schema.org', '@graph': graph } };
}
