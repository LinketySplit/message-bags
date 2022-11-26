export type MessageBag = {
  [key: string]: MessageBag | string | ((...args: never[]) => string);
};
import { TRANSLATIONS_FILE_NAME } from './_cli/constants';

const moduleLoadFns: Record<string, () => Promise<Record<string, unknown>>> =
  import.meta.glob('/src/i18n/**/*.ts', {
    import: 'messages'
  }) as Record<string, () => Promise<Record<string, unknown>>>;
const loadedTranslations: Record<string, Record<string, unknown>> = {};

const isObject = (value: unknown): boolean => {
  return Object.prototype.toString.call(value) === '[object Object]';
};

const mergeDeep = <T extends MessageBag>(
  translated: Partial<T>,
  original: T
): T => {
  const result: T = { ...original };
  Object.keys(original).forEach((key: keyof T) => {
    const value = original[key];
    if (isObject(value)) {
      if (isObject(translated[key])) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result[key] = mergeDeep(translated[key] as any, value as any) as any;
      }
      return;
    }
    if (typeof value === typeof translated[key]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result[key] = translated[key] as any
    }
  });
  return result;
};

export const loadLocale = async (locale: string) => {
  const endsWith = `${TRANSLATIONS_FILE_NAME}.${locale}.ts`;
  const filePaths: string[] = Object.keys(moduleLoadFns).filter((s) =>
    s.endsWith(endsWith)
  );
  const promises = filePaths.map((filePath) => {
    return moduleLoadFns[filePath]().then((mod) => {
      loadedTranslations[filePath] = mod;
    });
  });
  await Promise.all(promises)
};

export const createMessages = <T extends MessageBag>(
  messageBagId: string,
  messageBag: T,
  locale?: string
): T => {
  if (!locale) {
    return messageBag;
  }
  const path = `/src/i18n/${messageBagId}/${TRANSLATIONS_FILE_NAME}.${locale}.ts`;
  if (isObject(loadedTranslations[path])) {
    return mergeDeep((loadedTranslations[path]) as Partial<T>, messageBag);
  }
  return messageBag;
};
