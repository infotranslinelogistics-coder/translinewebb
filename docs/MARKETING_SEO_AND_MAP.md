# Marketing SEO and delivery map

## Page inventory

The marketing build pre-renders 2,196 pages from a single React entry graph: 1,768 locality records, 382 postcode groups, and 46 main/service/directory pages. Each route is a real HTML document with a unique title, description, canonical, JSON-LD and crawlable links. No crawler-specific content or hidden keyword pages are used. Freight service pages include dedicated `Service` structured data connected to the Transline organisation.

Locality pages provide approximate geographic reference, straight-line distance from central Perth, nearby places, related postcode entries and booking preparation. Postcode pages list their associated towns/suburbs. These directory entries do not assert guaranteed service, a local office, completed deliveries, driving distance or delivery time. Source estimates must be checked against the actual street address.

The build reads `SITE_URL` (or `VITE_SITE_URL`) as the trusted HTTPS canonical origin, defaulting to the existing `https://translinewebb.vercel.app`. Set this to the verified production domain if it changes. The three sitemap files and sitemap index are generated during the build. Robots allows crawlers to read public pages; portal pages carry `noindex,nofollow`, also emitted as response headers. Do not block `/portal` in robots while relying on the noindex directive, because crawlers must fetch the page to read it.

Preview deployments should remain unindexed through Vercel's preview controls. Indexing or ranking is not guaranteed by page count. Add verified operational details to pages over time, and use Search Console to inspect indexing and query performance. Google guidance: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics and https://developers.google.com/search/docs/essentials/spam-policies .

## Geography sources

`src/data/geography-sources.json` records source URLs, licences, hashes, filters and limitations. The WA postal-place extract is adapted from GeoNames under CC BY 4.0. Page footnotes attribute it and link the licence. The `sourceAdmin2` field is retained only for auditing; known source errors mean it must not be displayed as a verified local government area. No LGA claims are derived from it.

The map uses Natural Earth 1:50m geographic coastline data in the public domain. It includes mainland Australia, Tasmania and nearby represented islands. Macquarie Island is omitted to maintain a useful mainland view. Latitude and longitude are projected consistently; the shape is not hand-drawn or generated artwork. The red western area is WA; the Perth square is labelled as the operations base.

## Approved delivery history

`src/data/approved-deliveries.json` is deliberately empty until real, confirmed, publicly usable locations are available. The repository has work shifts, GPS events and detected stops, not a completed-delivery dataset. Neither completed shifts nor detected stops should be relabelled as deliveries.

Approved public records use exactly these fields:

```ts
type DeliveryPoint = {
  id: string;        // New public location identifier, not an internal job/customer ID
  locality: string;  // Approved town or suburb name
  state: string;    // State abbreviation
  latitude: number; // Approved town/suburb reference point
  longitude: number;
};
```

Store the records under `points`. Do not include raw customer addresses, GPS breadcrumbs, live positions, vehicle registrations, names, shift IDs or private timestamps. The map renders points only and provides a keyboard-accessible location selector. Directory reference pins are explicitly labelled as locality references and never included in past-delivery counts. Existing private driver GPS remains in the authenticated Live Map.

## Build and verification

- `npm run build`: marketing client, server-rendered HTML, sitemaps and portal output.
- `npm run typecheck:marketing`: active marketing TypeScript graph.
- `npm run verify:site`: all rendered page headings, metadata, structured data, internal links, assets, discoverability, sitemap coverage, indexing directives and delivery data contract.
- `npm --prefix portal test`: existing portal tests.

## Booking enquiry email

The public booking form posts directly to `/api/enquiry`. The server validates and bounds every field, rejects the hidden spam field, escapes customer-provided values and asks Resend to email the enquiry to dispatch. The browser shows success only after Resend accepts the message; it retains the entered values and shows phone/email alternatives when submission fails.

Configure `RESEND_API_KEY`, `ENQUIRY_FROM_EMAIL` and, if the recipient differs from the default, `ENQUIRY_TO_EMAIL` in the production host. `ENQUIRY_FROM_EMAIL` must use a sender identity verified in Resend. These are server-only values and must never use a `VITE_` prefix. See `.env.example` for the expected names.

Unknown marketing routes use a genuine HTTP 404 in Express/Netlify and the generated `404.html` on Vercel. Known marketing routes resolve to generated static pages. The portal retains its separate SPA routing.
