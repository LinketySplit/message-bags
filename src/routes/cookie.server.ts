import type { RequestEvent } from '@sveltejs/kit';
import {
  PUBLIC_I18N_SUPPORTED_LOCALES,
  PUBLIC_I18N_DEFAULT_LOCALE
} from '$env/static/public';
const supportedLocales = PUBLIC_I18N_SUPPORTED_LOCALES.split(',')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);
export const getLocale = (event: RequestEvent): string => {
  const cookieLocale = event.cookies.get('locale');
  if (cookieLocale && supportedLocales.includes(cookieLocale)) {
    return cookieLocale;
  }
  return PUBLIC_I18N_DEFAULT_LOCALE;
};
export const setLocaleCookie = (event: RequestEvent, locale: string): void => {
  if (
    supportedLocales.includes(locale) &&
    locale !== PUBLIC_I18N_DEFAULT_LOCALE
  ) {
    event.cookies.set('locale', locale, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60
    });
  } else {
    event.cookies.delete('locale', {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax'
    });
  }
};
