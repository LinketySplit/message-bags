const PUBLIC_I18N_DEFAULT_LOCALE = 'PUBLIC_I18N_DEFAULT_LOCALE';
const PUBLIC_I18N_SUPPORTED_LOCALES = 'PUBLIC_I18N_SUPPORTED_LOCALES';
export type I18NEnv = {
  defaultLocale: string;
  supportedLocales: string[];
};

export const validateEnvVariables = (env: Record<string, string>): I18NEnv => {
  const defaultLocale = env[PUBLIC_I18N_DEFAULT_LOCALE];
  if (typeof defaultLocale !== 'string' || defaultLocale.length === 0) {
    throw new Error(
      `The default locale must be defined in your environment as PUBLIC_I18N_DEFAULT_LOCALE. ` +
        `For example, put PUBLIC_I18N_DEFAULT_LOCALE=en-us in your .env file. `
    );
  }
  let supportedLocales: string[] = [];
  if (typeof env[PUBLIC_I18N_SUPPORTED_LOCALES] === 'string') {
    supportedLocales = env[PUBLIC_I18N_SUPPORTED_LOCALES].split(',')
      .map((s) => s.trim())
      .filter((s) => s.length === 0);
  }

  return { defaultLocale, supportedLocales };
};

export const parseMessageId = (
  id: string
): { messageBagId: string; messageKey: string } => {
  const parts = id.split('/');
  const messageKey = parts.pop() || '';
  const messageBagId = parts.join('/');
  return { messageBagId, messageKey };
};
