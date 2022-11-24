import type { RequestEvent } from "@sveltejs/kit";

export const getLocale = (event: RequestEvent) => {
  return event.cookies.get('locale') || 'en';
}

export const setLocale = (event: RequestEvent, locale: string) => {
  event.cookies.set('locale', locale, {path: '/'});
}