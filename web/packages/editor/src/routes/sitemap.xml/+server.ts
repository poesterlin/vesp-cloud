import type { RequestHandler } from './$types';

export const prerender = true;
const INDEXABLE_PATHS = ['/intro', '/home-assistant-entity-export', '/terms', '/withdrawal'];
const SITEMAP_LASTMOD = new Date().toISOString();

export const GET: RequestHandler = ({ url }) => {
  const urls = INDEXABLE_PATHS.map((path) => {
    const loc = `${url.origin}${path}`;

    return `<url><loc>${loc}</loc><lastmod>${SITEMAP_LASTMOD}</lastmod></url>`;
  }).join('');

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    urls +
    '</urlset>';

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
