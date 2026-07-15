import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';

const BASE_INDEXABLE_PATHS = [
  '/intro',
  '/home-assistant-entity-export',
  '/withdrawal',
];

export const GET: RequestHandler = ({ url }) => {
  const indexablePaths = dev || env.APP_EDITION === 'cloud'
    ? [...BASE_INDEXABLE_PATHS, '/impressum', '/privacy', '/terms']
    : BASE_INDEXABLE_PATHS;
  const sitemapLastmod = new Date().toISOString();
  const urls = indexablePaths.map((path) => {
    const loc = `${url.origin}${path}`;

    return `<url><loc>${loc}</loc><lastmod>${sitemapLastmod}</lastmod></url>`;
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
