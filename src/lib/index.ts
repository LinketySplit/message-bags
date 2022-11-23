export type MessageBag = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: MessageBag | string | ((...args: any) => string);
};
import { TRANSLATIONS_FILE_NAME } from './_cli/constants';

const moduleLoadFns: Record<string, () => Promise<Record<string, unknown>>> =
  import.meta.glob('/src/i18n/**/*.ts', {
    import: 'messages'
  }) as Record<string, () => Promise<Record<string, unknown>>>;
const loadedMessageBags: Record<string, Record<string, unknown>> = {};

const mergeDeep = <T extends MessageBag>(translated: Partial<T>, original: T): T => {
  const result: T = {...original}
  Object.keys(original).forEach((key: keyof T) => {
    const value = original[key]
    if (typeof value === 'function') {
      if (typeof translated[key] === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result[key] = translated[key] as any;
      }
      return;
    }
    if (typeof value === 'string') {
      if (typeof translated[key] === 'string') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result[key] = translated[key] as any;
      }
      return;
    }
    if (Object.prototype.toString.call(value) === '[object Object]') {
      if (Object.prototype.toString.call(translated[key]) === '[object Object]') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result[key] = mergeDeep(translated[key] as any, value) as any
      }
    }
  })
  return result;
}

export const defineMessageBag = <T extends MessageBag>(
  messageBagId: string,
  messageBag: T
): ((locale?: string) => Promise<T>) => {
  const promise = async (locale?: string) => {
    if (!locale) {
      return messageBag;
    }
    const path = `/src/i18n/${messageBagId}/${TRANSLATIONS_FILE_NAME}.${locale}.ts`;
    if (!moduleLoadFns[path]) {
      return messageBag;
    }
    if (!loadedMessageBags[path]) {
      loadedMessageBags[path] = await moduleLoadFns[path]();
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return mergeDeep((loadedMessageBags[path] || {}) as any, messageBag)
  };
  return promise;
};
