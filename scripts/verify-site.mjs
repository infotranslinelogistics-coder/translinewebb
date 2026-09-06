import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { getAllPaths, getPage, seoFor } from '../.build/server/entry-server.js';

const root = process.cwd();
const paths = getAllPaths();
assert(paths.length >= 2000, 'At least 2,000 real marketing routes must be generated');
assert.equal(new Set(paths).size, paths.length, 'Routes must be unique');
const report = JSON.parse(await readFile('dist/build-report.json', 'utf8'));
assert.equal(report.pages, paths.length);
const origin = report.origin;
const known = new Set(paths);
const assets = new Set();
const incoming = new Set(['/']);
let checkedLinks = 0;
for (const route of paths) {
  const page = getPage(route);
  const file = route === '/' ? 'dist/index.html' : path.join('dist', route.slice(1), 'index.html');
  const html = await readFile(file, 'utf8');
  assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, `${route}: expected one H1`);
  const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] || '';
  assert.equal((head.match(/<title>/g) || []).length, 1, `${route}: expected one document title`);
  assert(html.includes(`<link rel="canonical" href="${seoFor(page, origin).url}"`), `${route}: canonical mismatch`);
  assert(html.includes('application/ld+json'), `${route}: missing structured data`);
  const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert(JSON.parse(jsonLd)['@graph'].length >= 3, `${route}: malformed structured data`);
  assert(!/Active corridors?|2× weekly|72h transit|Customer portal/i.test(html), `${route}: obsolete claims`);
  assert(!/src="\/src\//.test(html), `${route}: source assets in production`);
  for (const match of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
    let href = match[1].split(/[?#]/)[0].replace(/\/$/, '') || '/';
    if (href.startsWith('/portal') || href.startsWith('/_vercel')) continue;
    if (/\.[a-z0-9]+$/i.test(href)) { assets.add(href); continue; }
    checkedLinks++;
    assert(known.has(href), `${route}: broken internal link ${href}`);
    incoming.add(href);
  }
}
assert.equal(incoming.size, known.size, 'Every page must be discoverable through HTML links');
for (const asset of assets) await access(path.join(root, 'dist', asset.slice(1)));
const sitemapIndex = await readFile('dist/sitemap.xml', 'utf8');
const sitemapUrls = new Set();
for (const name of sitemapIndex.matchAll(/<loc>[^<]*\/(sitemap-\d+\.xml)<\/loc>/g)) {
  const xml = await readFile(path.join('dist', name[1]), 'utf8');
  for (const loc of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) { assert(!sitemapUrls.has(loc[1]), 'Duplicate sitemap URL'); sitemapUrls.add(loc[1]); }
}
assert.equal(sitemapUrls.size, paths.length, 'Sitemaps must cover every indexable page');
const notFound = await readFile('dist/404.html', 'utf8');
assert(notFound.includes('noindex,follow'), '404 must be noindex');
const portal = await readFile('portal/index.html', 'utf8');
assert(portal.includes('noindex,nofollow'), 'Admin portal must be noindex');
const deliveryData = JSON.parse(await readFile('src/data/approved-deliveries.json', 'utf8'));
const ids = new Set();
for (const point of deliveryData.points) {
  assert.deepEqual(Object.keys(point).sort(), ['id','latitude','locality','longitude','state'].sort(), 'Only approved locality-level fields may be published');
  assert(!ids.has(point.id) && point.id && point.locality && point.state, 'Delivery point IDs and labels must be present and unique');
  ids.add(point.id);
  assert(Number.isFinite(point.latitude) && point.latitude >= -44 && point.latitude <= -10 && Number.isFinite(point.longitude) && point.longitude >= 112 && point.longitude <= 154, 'Delivery point outside Australia map');
}
console.log(`PASS: ${paths.length} rendered routes, ${checkedLinks} internal links, ${assets.size} asset links, 3 sitemaps, 404/admin indexing controls, ${deliveryData.points.length} approved delivery points.`);
