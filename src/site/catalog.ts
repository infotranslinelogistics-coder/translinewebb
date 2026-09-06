import localityData from '../data/wa-localities.json';

export interface Locality { id: string; name: string; postcode: string; lat: number; lng: number; accuracy: number }
export const localities = localityData as Locality[];
export const postcodes = [...new Set(localities.map(place => place.postcode))].sort();
const byId = new Map(localities.map(place => [place.id, place]));
export const PAGE_SIZE = 60;
export const directoryPages = Math.ceil(localities.length / PAGE_SIZE);

export const services = [
  { slug: 'general-freight', name: 'General freight', tag: 'Pallets + commercial loads', body: 'Palletised goods, equipment and commercial freight. Dispatch matches the load dimensions, total weight and site access to a suitable vehicle.', details: ['Pallet count and dimensions', 'Total consignment weight', 'Forklift or unloading arrangements'], fit: 'Curtainsider, flatbed or pantech, depending on access and load.' },
  { slug: 'hotshots', name: 'Hotshots', tag: 'Urgent + dedicated transport', body: 'Dedicated point-to-point transport for urgent freight and time-critical parts. Dispatch checks pickup readiness, vehicle fit and direct-run availability before accepting the job.', details: ['Pickup-ready time and required arrival window', 'Complete load dimensions and weight', 'Site contacts and loading access at both ends'], fit: 'A dedicated vehicle selected around the load, access and required timing.' },
  { slug: 'express-delivery', name: 'Express delivery', tag: 'Priority + time-sensitive freight', body: 'Priority delivery for parcels and smaller freight with a required window. Share both addresses, the consignment size and the deadline so dispatch can confirm the fastest practical option.', details: ['Parcel or consignment dimensions and weight', 'Required pickup and delivery windows', 'Sender and receiver contact details'], fit: 'Cargo van or another suitable vehicle, with timing confirmed by dispatch.' },
  { slug: 'courier', name: 'Courier', tag: 'Scheduled parcels + documents', body: 'Documents, parcels and smaller consignments planned around an agreed collection window. Give dispatch both addresses, item details and receiver contact information.', details: ['Parcel sizes and quantities', 'Preferred collection window', 'Receiver name and contact number'], fit: 'Cargo van for smaller consignments and accessible collections.' },
  { slug: 'oversize', name: 'Oversize freight', tag: 'Irregular loads + open deck', body: 'Equipment and awkward loads that need an open deck. Dimensions, restraints and loading arrangements are assessed before the job is accepted.', details: ['Length, width, height and weight', 'Lifting or forklift requirements', 'Restraint points and access restrictions'], fit: 'Flatbed where an open deck is suitable. Dispatch confirms load and permit requirements.' },
  { slug: 'removals', name: 'Removals', tag: 'Homes + workplaces', body: 'Furniture, office equipment and commercial moves. Tell us the inventory, stairs, parking access and the help available at each end.', details: ['Inventory and bulky items', 'Stairs, lifts and parking distance', 'Packing and loading assistance needed'], fit: 'Enclosed pantech, with capacity confirmed against the item list.' },
];

export const fleet = [
  { name: 'Cargo vans', tag: '01 / Light + agile', body: 'For parcels, documents and small freight with straightforward loading access.', points: ['Enclosed load space', 'Small consignments', 'Metro collections'] },
  { name: 'Flatbeds', tag: '02 / Open deck', body: 'For equipment and irregular goods that need side or overhead loading.', points: ['Open-platform loading', 'Forklift or crane access', 'Load-specific restraints'] },
  { name: 'Curtainsiders', tag: '03 / Side access', body: 'For palletised commercial freight where side loading makes the work simpler.', points: ['Side loading access', 'Palletised freight', 'Covered transport'] },
  { name: 'Pantechs', tag: '04 / Enclosed body', body: 'For furniture, removals and commercial loads that need an enclosed body.', points: ['Enclosed body', 'Commercial + residential', 'Listed capacity up to 14 t'] },
];

type Kind = 'home' | 'freight' | 'service' | 'coverage' | 'fleet' | 'tracking' | 'about' | 'contact' | 'quote' | 'privacy' | 'directory' | 'locality' | 'postcodes' | 'postcode' | 'notfound';
export interface PageInfo { path: string; kind: Kind; title: string; heading: string; description: string; index: boolean; place?: Locality; postcode?: string; page?: number; service?: typeof services[number] }
const core: PageInfo[] = [
  { path: '/', kind: 'home', title: 'Transline Logistics | Perth Freight, Hotshots & Express', heading: 'Built to move.', description: 'Freight, hotshots, express delivery, courier and removals from Perth across Western Australia. Book direct with Transline dispatch.', index: true },
  { path: '/freight', kind: 'freight', title: 'Freight & Transport Services in Perth | Transline Logistics', heading: 'The right move. For every load.', description: 'Explore general freight, hotshots, express delivery, courier, oversize transport and removals with Transline Logistics. Send the load and access details to dispatch.', index: true },
  { path: '/coverage', kind: 'coverage', title: 'Past Delivery Points & WA Coverage | Transline Logistics', heading: 'Places. We deliver.', description: 'Explore the Australia delivery map and discuss your Perth or regional WA pickup and destination with Transline dispatch.', index: true },
  { path: '/fleet', kind: 'fleet', title: 'Our Transport Fleet | Vans, Flatbeds & Pantechs | Transline', heading: 'Different loads. Same standard.', description: 'Explore Transline’s cargo vans, flatbeds, curtainsiders and pantechs. Find the right loading format for your freight, courier consignment or move.', index: true },
  { path: '/driver-tracking', kind: 'tracking', title: 'Driver Tracking for Transline Administrators', heading: 'Every driver. In view.', description: 'Authorised Transline administrators can track driver locations, assigned vehicles, active shifts and route history through the secure admin portal.', index: true },
  { path: '/about', kind: 'about', title: 'About Transline Logistics | Perth Transport Operations', heading: 'Perth based. Hands on.', description: 'Meet the approach behind Transline Logistics: company-owned vehicles, direct dispatch and clear load planning for Perth and regional Western Australia.', index: true },
  { path: '/contact', kind: 'contact', title: 'Contact Transline Logistics | Perth Dispatch', heading: 'Talk to dispatch.', description: 'Call Transline Logistics on 0466 582 734 or email admin@translinelogistics.org for freight enquiries, delivery updates and bookings.', index: true },
  { path: '/quote', kind: 'quote', title: 'Book Freight, Hotshots & Express Delivery | Transline Perth', heading: 'Book now.', description: 'Send a booking enquiry for freight, hotshots, express delivery, courier or removals with your pickup, destination, load details and preferred window.', index: true },
  { path: '/privacy', kind: 'privacy', title: 'Privacy Policy | Transline Logistics', heading: 'Your information.', description: 'Read the Transline Logistics privacy policy covering booking details, communications and personal information.', index: true },
  { path: '/locations', kind: 'directory', title: 'Western Australia Freight Location Directory | Transline', heading: 'Find your next stop.', description: 'Search Western Australian towns, suburbs and postcodes. Find locality coordinates, nearby places and pickup details to prepare a transport enquiry.', index: true, page: 1 },
  { path: '/postcodes', kind: 'postcodes', title: 'Western Australia Postcode Directory | Transline Logistics', heading: 'Every postcode. In one place.', description: 'Look up Western Australian postcodes and their listed towns and suburbs. Prepare clearer pickup and delivery details for your freight enquiry.', index: true },
];
const coreMap = new Map(core.map(page => [page.path, page]));
export function normalisePath(input: string) { const path = input.split('?')[0].replace(/\/+$/, ''); return path || '/'; }
export function getPage(input: string): PageInfo {
  const path = normalisePath(input);
  if (coreMap.has(path)) return coreMap.get(path)!;
  const service = services.find(item => path === `/freight/${item.slug}`);
  if (service) return { path, kind: 'service', title: `${service.name} in Perth & WA | Transline Logistics`, heading: service.name, description: service.body, index: true, service };
  const pageMatch = path.match(/^\/locations\/page\/(\d+)$/);
  if (pageMatch) { const page = Number(pageMatch[1]); if (page >= 2 && page <= directoryPages) return { ...coreMap.get('/locations')!, path, page, title: `WA Location Directory — Page ${page} | Transline Logistics` }; }
  const place = byId.get(path.replace(/^\/locations\//, ''));
  if (path.startsWith('/locations/') && place) return { path, kind: 'locality', place, title: `${place.name} WA ${place.postcode} | Freight Location Guide | Transline`, heading: place.name, description: `Plan a pickup or delivery enquiry for ${place.name}, WA ${place.postcode}. Check approximate location, nearby towns, address details and freight preparation.`, index: true };
  const postcode = path.replace(/^\/postcodes\//, '');
  if (path.startsWith('/postcodes/') && postcodes.includes(postcode)) return { path, kind: 'postcode', postcode, title: `WA ${postcode} Postcode | Towns & Freight Planning | Transline`, heading: `WA ${postcode}`, description: `Find towns and suburbs listed under Western Australia postcode ${postcode}, compare their locations and prepare accurate pickup and destination details.`, index: true };
  return { path, kind: 'notfound', title: 'Page Not Found | Transline Logistics', heading: 'Off the map.', description: 'This page could not be found. Find freight services or contact Transline dispatch.', index: false };
}
export function getAllPaths() { return [...core.map(page => page.path), ...services.map(item => `/freight/${item.slug}`), ...Array.from({ length: directoryPages - 1 }, (_, i) => `/locations/page/${i + 2}`), ...localities.map(place => `/locations/${place.id}`), ...postcodes.map(code => `/postcodes/${code}`)]; }
export function distanceKm(a: Pick<Locality, 'lat' | 'lng'>, b: Pick<Locality, 'lat' | 'lng'>) {
  const rad = Math.PI / 180; const dlat = (b.lat - a.lat) * rad; const dlng = (b.lng - a.lng) * rad;
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlng / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}
export const perth = { lat: -31.9523, lng: 115.8613 };
export function nearbyPlaces(place: Locality) { return localities.filter(item => item.id !== place.id).map(item => ({ ...item, distance: distanceKm(place, item) })).sort((a,b) => a.distance - b.distance || a.name.localeCompare(b.name)).slice(0, 6); }
