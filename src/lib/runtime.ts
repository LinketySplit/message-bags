import { parseMessageId } from './shared';

type FirstArg<T> = T extends (
  first: infer FirstArgument,
  ...args: unknown[]
) => unknown
  ? FirstArgument
  : never;

type TranslatedMessageBag = {
  [messageId: string]: string | ((data: Record<string, unknown>) => string);
};

export function t(
  messageId: string,
  definition: string
): (locale?: string) => Promise<string>;

export function t<
  DefType extends (data: DataType) => string,
  DataType = FirstArg<DefType>
>(
  messageId: string,
  definition: DefType
): (data: DataType, locale?: string) => Promise<string>;

export function t(messageId: string, definition: unknown) {
  const { messageKey, messageBagId } = parseMessageId(messageId);
  if (typeof definition === 'string') {
    const fn = async (locale?: string): Promise<string> => {
      const bag =
        typeof locale === 'string'
          ? await MessageLoader.inst().loadMessageBag(messageBagId, locale)
          : {};
      const resolved =
        bag && typeof bag[messageId] === 'string'
          ? bag[messageId]
          : (definition as string);
      return resolved as string;
    };
    return fn;
  }
  const fn = async (data: unknown, locale?: string): Promise<string> => {
    const bag =
      typeof locale === 'string'
        ? await MessageLoader.inst().loadMessageBag(messageBagId, locale)
        : {};
    const resolved = (
      bag && typeof bag[messageKey] === 'function'
        ? bag[messageKey]
        : definition
    ) as (data: unknown) => string;
    return resolved(data);
  };
  return fn;
}

class MessageLoader {
  private moduleLoadFns: Record<string, () => Promise<TranslatedMessageBag>>;
  private loadedMessageBags: Record<string, TranslatedMessageBag> = {};
  private static instance: MessageLoader | null = null;
  public static inst(): MessageLoader {
    if (!this.instance) {
      this.instance = new MessageLoader();
    }
    return this.instance;
  }
  private constructor() {
    this.moduleLoadFns = import.meta.glob('/src/i18n/**/*.ts', {
      import: 'messages'
    }) as Record<string, () => Promise<TranslatedMessageBag>>;
  }
  public async loadMessageBag(
    messageBagId: string,
    locale: string
  ): Promise<TranslatedMessageBag> {
    const bagPath = `src/i18n/${messageBagId}/${locale}.ts`;
    if (!this.loadedMessageBags[bagPath]) {
      if (!this.moduleLoadFns[bagPath]) {
        this.loadedMessageBags[bagPath] = {};
      } else {
        this.loadedMessageBags[bagPath] = await this.moduleLoadFns[bagPath]();
      }
    }
    return this.loadedMessageBags[bagPath];
  }
}

const test1 = t('test.str', 'hhhghg');
const msg1 = await test1();
const test2 = t('test.fn', (data: { foo: string }) => `Hello, ${data.foo}`);
const msg = await test2({ foo: 'bar' }, 'en');
