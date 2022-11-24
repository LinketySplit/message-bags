import { localePickerMessages} from './messages';
import type { LayoutLoad } from './$types'
export const load: LayoutLoad = async (event) => {
  
  return {
    ...(event.data),
    localePickerMessages: await localePickerMessages(event.data.locale)
  }
}