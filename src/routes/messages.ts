import { createMessages } from "$lib";

export const homePageMessages = createMessages('home', {
  /**
   * The welcome message.
   */
  welcome: 'Welcome to Message Bags!'
})


export const localePickerMessages = createMessages('locale-picker', {
  /**
   * The prompt to click on one of the locale links, to set the language.
   */
  prompt: 'Pick a locale',
  /**
   * The sentence that shows the current locale code.
   */
  currentLocale: (localeCode: string) => {
    return `You are currently using the ${localeCode} locale.`;
  },
  /**
   * The labels for each supported language/locale.
   */
  locales: {
    en_US: 'U.S. English',
    es: 'Spanish'
  }
})