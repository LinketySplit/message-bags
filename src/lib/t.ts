import type { MessageBag } from './types';

const moduleLoadFns: Record<string, () => Promise<Record<string, unknown>>> =
  import.meta.glob('/src/i18n/**/*.ts', {
    import: 'messages'
  }) as Record<string, () => Promise<Record<string, unknown>>>;
const loadedMessageBags: Record<string, Record<string, unknown>> = {};

export const defineMessageBag = <T extends MessageBag>(
  messageBagId: string,
  messageBag: T
): ((locale?: string) => Promise<T>) => {
  const promise = async (locale?: string) => {
    if (!locale) {
      return messageBag;
    }
    const path = `/src/i18n/${messageBagId}/${locale}.ts`;
    if (!moduleLoadFns[path]) {
      return messageBag;
    }
    if (!loadedMessageBags[path]) {
      loadedMessageBags[path] = await moduleLoadFns[path]();
    }
    return {
      ...messageBag,
      ...loadedMessageBags[path]
    } as T;
  };
  return promise;
};
