import * as publicEnv from '$env/static/public';
import { validateEnvVariables, parseMessageId, type I18NEnv } from './shared';
// const i18nPath = 'src/i18n';

type FirstArg<T> = T extends (
  first: infer FirstArgument,
  ...args: unknown[]
) => unknown
  ? FirstArgument extends undefined
    ? never
    : FirstArgument
  : never;

// type ShouldBeStr = FirstArg<(data: {name: string}) => number>;
// type Def = (data: { foo: number }) => string;
// type DataType = FirstArg<Def>;

type TranslatedMessageBag = {
  [messageId: string]: string | ((data: Record<string, unknown>) => string);
};
// export type MessagePromise<D> = D extends Record<string, unknown>
//   ? (locale: string, data: D) => Promise<string>
//   : (locale: string) => Promise<string>;

export function translateFn(
  messageId: string,
  definition: string
): (locale: string) => Promise<string>;
export function translateFn<
  DefType extends (data: DataType) => string, DataType = FirstArg<DefType>
>(
  messageId: string,
  definition: (data: DataType) => string
): (data: DataType, locale: string) => Promise<string>;
export function translateFn(
  messageId: string,
  definition: unknown
) {
  const { messageKey, messageBagId } = parseMessageId(messageId);
  if (typeof definition === 'string') {
    const fn = async (locale: string): Promise<string> => {
      const bag = await MessageLoader.inst().loadMessageBag(
        messageBagId,
        locale
      );
      const resolved =
        bag && typeof bag[messageId] === 'string'
          ? bag[messageId]
          : (definition as string);
      return resolved as string;
    };
    return fn;
  }
  const fn = async (
    data: unknown,
    locale: string
  ): Promise<string> => {
    const bag = await MessageLoader.inst().loadMessageBag(messageBagId, locale);
    const resolved = (
      bag && typeof bag[messageKey] === 'function'
        ? bag[messageKey]
        : definition
    ) as (data: unknown) => string;
    return resolved(data);
  };
  return fn;
}

const test1 = translateFn('test.str', 'hhhghg');
const test2 = translateFn(
  'test.fn',
  (data: { foo: string }) => `Hello, ${data.foo}`
);

class MessageLoader {
  private env: I18NEnv;
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
    this.env = validateEnvVariables(publicEnv);
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
