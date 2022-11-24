import type { Messages } from './type';

export const messages: Messages = {
  /**
   * The prompt to click on one of the locale links, to set the language.
   * Message: "prompt"
   *
   * Untranslated:
   * 'Pick a locale'
   */
  prompt: 'Elige un lugar',
  /**
   * The sentence that shows the current locale code.
   * Message: "currentLocale"
   *
   * Untranslated:
   * (localeCode: string) => {
   *    return `You are currently using the ${localeCode} locale.`;
   *  }
   */
  currentLocale: (localeCode: string) =>
    `Actualmente está utilizando la configuración regional "${localeCode}."`,
  /**
   * The labels for each supported language/locale.
   * Message Group: "locales"
   */
  locales: {
    /**
     * Message: "locales.en_US"
     *
     * Untranslated:
     * 'U.S. English'
     */
    en_US: 'Ingles (US)',
    /**
     * Message: "locales.es"
     *
     * Untranslated:
     * 'Spanish'
     */
    es: 'Espanol'
  }
};
