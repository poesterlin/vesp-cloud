import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import { isPublicRoute } from '$lib/server/routes';

export const load: LayoutServerLoad = async (event) => {
  const path = event.url.pathname;

  if (!isPublicRoute(event.route.id) && !event.locals.user) {
    if (path === '/') {
      redirect(302, '/intro');
    }
    redirect(302, '/login?redirect=' + encodeURIComponent(path + event.url.search));
  }

  return {
    user: event.locals.user,
    showCloudLegalPages: dev || env.APP_EDITION === 'cloud',
  };
};
