import { writable, type Readable, type Writable } from 'svelte/store';
import { BagLoader } from './bag-loader';
import { parseMessageId } from './shared';

type FirstArg<T> = T extends (
  first: infer FirstArgument,
  ...args: unknown[]
) => unknown
  ? FirstArgument
  : never;

export function ski18nT(
  messageId: string,
  definition: string
): (locale?: string) => Promise<string>;

export function ski18nT<
  DefType extends (data: DataType) => string,
  DataType = FirstArg<DefType>
>(
  messageId: string,
  definition: DefType
): (data: DataType, locale?: string) => Promise<string>;

export function ski18nT(messageId: string, definition: unknown) {
  const { messageKey, messageBagId } = parseMessageId(messageId);
  if (typeof definition === 'string') {
    const fn = async (locale?: string): Promise<string> => {
      const bag =
        typeof locale === 'string'
          ? await BagLoader.inst().loadMessageBag(messageBagId, locale)
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
        ? await BagLoader.inst().loadMessageBag(messageBagId, locale)
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

export function ski18nTReadable(
  messageId: string,
  definition: string,
  passed: {locale?: string}
): Readable<string>;

export function ski18nTReadable<
  DefType extends (data: DataType) => string,
  DataType = FirstArg<DefType>
>(
  messageId: string,
  definition: DefType,
  passed: {locale?: string, data: DataType}
): Readable<string>;

export function ski18nTReadable(
  messageId: string,
  definition: unknown,
  passed: unknown
): Readable<string> {
  const passedData: {locale: string, data: unknown} = {
    locale: '',
    data: {},
    ...(passed || {})
  }
  const { messageKey, messageBagId } = parseMessageId(messageId);
  let result: Writable<string>;
  if (typeof definition === 'string') {
    result = writable(definition);
  } else {
    result = writable((definition as (data: unknown) => string)(passedData.data));
  }
  BagLoader.inst()
    .loadMessageBag(messageBagId, passedData.locale || '')
    .then((bag) => {
      const resolved = bag[messageKey];
      if (typeof resolved === 'string') {
        result.set(resolved);
      } else {
        result.set((resolved as (data: unknown) => string)(passedData.data));
      }
    });
  return { subscribe: result.subscribe };
}
