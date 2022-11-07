import type { LayoutServerLoadEvent } from './$types';
import { getLocale } from './cookie.server';

export const load = (event: LayoutServerLoadEvent) => {
  return {
    locale: getLocale(event)
  };
};
