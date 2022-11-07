import { BagLoader } from "./bag-loader";
import { parseMessageId } from "./shared";

type FirstArg<T> = T extends (
  first: infer FirstArgument,
  ...args: unknown[]
) => unknown
  ? FirstArgument
  : never;



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
