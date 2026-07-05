import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

const PUBLIC_PATHS = [
  '/robots.txt',
  '/sitemap.xml',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/terms',
  '/intro',
  '/withdrawal',
  '/api/firmware',
  '/api/stripe/webhook',
];

export const load: LayoutServerLoad = async (event) => {
  const path = event.url.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!isPublic && !event.locals.user) {
    if (path === '/') {
      redirect(302, '/intro');
    }
    redirect(302, '/login?redirect=' + encodeURIComponent(path + event.url.search));
  }

  return {
    user: event.locals.user,
  };
};
