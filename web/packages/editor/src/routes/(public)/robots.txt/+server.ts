import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';

export const GET: RequestHandler = ({ url }) => {
  const origin = url.origin;
  const cloudOnlyPaths = dev || env.APP_EDITION === 'cloud'
    ? ['Allow: /impressum', 'Allow: /privacy', 'Allow: /terms']
    : [];
  const body = [
    'User-agent: *',
    'Allow: /intro',
    ...cloudOnlyPaths,
    'Allow: /withdrawal',
    'Disallow: /',
    `Sitemap: ${origin}/sitemap.xml`,
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
