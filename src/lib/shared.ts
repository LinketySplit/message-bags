
const PUBLIC_I18N_SRC_FOLDER_NAME = 'PUBLIC_I18N_SRC_FOLDER_NAME';
const PUBLIC_I18N_DEFAULT_LOCALE = 'PUBLIC_I18N_DEFAULT_LOCALE';
const PUBLIC_I18N_SUPPORTED_LOCALES = 'PUBLIC_I18N_SUPPORTED_LOCALES';
export type I18NEnv = {
	i18nSrcFolder: string;
	defaultLocale: string;
	supportedLocales: string[];
};


export const validateEnvVariables = (env: Record<string, string>): I18NEnv => {
	const i18nSrcFolder = env[PUBLIC_I18N_SRC_FOLDER_NAME];
	if (typeof i18nSrcFolder !== 'string' || i18nSrcFolder.length === 0 || '/' !== i18nSrcFolder[0]) {
		throw new Error(
			`The i18n source folder path must be defined in your environment as PUBLIC_I18N_SRC_FOLDER_NAME. ` +
				`The path must be absolute relative to the root directory (it must start with a '/'.) ` +
				`For example, put PUBLIC_I18N_SRC_FOLDER_NAME=/src/i18n in your .env file. `
		);
	}
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
  

	return { defaultLocale, i18nSrcFolder, supportedLocales };
};

export const parseMessageId = (id: string): {messageBagId: string, messageKey: string} => {
  const parts = id.split('/');
  const messageKey = parts.pop() || '';
  const messageBagId = parts.join('/');
  return {messageBagId, messageKey}
}
