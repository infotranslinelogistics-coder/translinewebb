import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { getAllPaths, getPage, renderPage, seoFor } from '../.build/server/entry-server.js';

const root = process.cwd();
const base = await readFile(path.join(root, 'dist/index.html'), 'utf8');
const origin = (process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://translinewebb.vercel.app').replace(/\/$/, '');
const parsed = new URL(origin);
if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error('SITE_URL must be a trusted HTTPS origin without a path, query or hash.');
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const paths = getAllPaths();
const titles = new Set();
for (const route of [...paths, '/404']) {
  const page = getPage(route); const meta = seoFor(page, origin);
  if (titles.has(meta.title)) throw new Error(`Duplicate page title: ${meta.title}`);
  titles.add(meta.title);
  const body = renderPage(route);
  const tags = `<title>${escape(meta.title)}</title>\n<meta name="description" content="${escape(meta.description)}" />\n<meta name="robots" content="${meta.robots}" />\n<link rel="canonical" href="${escape(meta.url)}" />\n<meta property="og:title" content="${escape(meta.title)}" />\n<meta property="og:description" content="${escape(meta.description)}" />\n<meta property="og:url" content="${escape(meta.url)}" />\n<meta property="og:locale" content="en_AU" />\n<meta name="twitter:title" content="${escape(meta.title)}" />\n<meta name="twitter:description" content="${escape(meta.description)}" />\n<script type="application/ld+json">${JSON.stringify(meta.structuredData).replace(/</g, '\\u003c')}</script>`;
  let html = base.replace(/<title>[\s\S]*?<\/title>/, '').replace(/<meta\s+(?:name|property)="(?:description|robots|og:title|og:description|og:url|og:locale|twitter:title|twitter:description)"[^>]*>/g, '').replace(/<link\s+rel="canonical"[^>]*>/g, '').replace('</head>', `${tags}\n</head>`).replace('<div id="root"></div>', `<div id="root" data-rendered-path="${escape(route)}">${body}</div>`);
  if (!html.includes(body)) throw new Error('Root placeholder missing.');
  const destination = route === '/' ? path.join(root, 'dist/index.html') : route === '/404' ? path.join(root, 'dist/404.html') : path.join(root, 'dist', route.slice(1), 'index.html');
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, html);
}
const groupSize = 1000;
const sitemapNames = [];
for (let offset = 0; offset < paths.length; offset += groupSize) {
  const name = `sitemap-${Math.floor(offset / groupSize) + 1}.xml`;
  sitemapNames.push(name);
  const urls = paths.slice(offset, offset + groupSize).filter(route => getPage(route).index).map(route => `<url><loc>${escape(seoFor(getPage(route), origin).url)}</loc></url>`).join('\n');
  await writeFile(path.join(root, 'dist', name), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
}
await writeFile(path.join(root, 'dist/sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapNames.map(name => `<sitemap><loc>${origin}/${name}</loc></sitemap>`).join('')}</sitemapindex>`);
await writeFile(path.join(root, 'dist/robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`);
await writeFile(path.join(root, 'dist/build-report.json'), JSON.stringify({ pages: paths.length, localityPages: paths.filter(p => getPage(p).kind === 'locality').length, postcodePages: paths.filter(p => getPage(p).kind === 'postcode').length, sitemapFiles: sitemapNames.length, origin }, null, 2));
console.log(`Pre-rendered ${paths.length} pages + 404. Generated ${sitemapNames.length} sitemaps at ${origin}.`);
