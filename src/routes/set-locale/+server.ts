import { redirect } from '@sveltejs/kit';
import { setLocaleCookie } from '../cookie.server';
import type { RequestEvent } from './$types';

export const GET = (event: RequestEvent) => {
  const redirectUrl = event.url.searchParams.get('redirect') || '/';
  const locale = event.url.searchParams.get('locale') || '';
  setLocaleCookie(event, locale);
  throw redirect(303, redirectUrl);
};
