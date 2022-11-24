import {homePageMessages} from './messages';
import type { PageLoad } from './$types'
export const load: PageLoad = async (event) => {
  const foo = await event.parent();
  console.log(foo)
  return {
    ...(event.data || {}),
    homePageMessages: await homePageMessages(foo.locale),
  }
}