import type { LayoutServerLoadEvent } from './$types'

export const load = (event: LayoutServerLoadEvent) => {
  const locale = event.cookies.get('locale') || 'en';
  console.log(locale)
  return {
    locale
  }
}