export type Messages = {
  /**
   * The prompt to click on one of the locale links, to set the language.
   * Message: "prompt"
   *
   * Untranslated:
   * 'Pick a locale'
   */
  prompt: string;

  /**
   * The sentence that shows the current locale code.
   * Message: "currentLocale"
   *
   * Untranslated:
   * (localeCode: string) => {
   *    return `You are currently using the ${localeCode} locale.`;
   *  }
   */
  currentLocale: (localeCode: string) => string;

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
    en_US: string;

    /**
     * Message: "locales.es"
     *
     * Untranslated:
     * 'Spanish'
     */
    es: string;
  };
};
