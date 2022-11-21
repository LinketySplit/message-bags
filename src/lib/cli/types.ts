import type {
  ArrowFunction,
  CallExpression,
  Expression,
  Node,
  ObjectLiteralExpression,
  PropertyAssignment,
  StringLiteral
} from 'ts-morph';
import type { LintError } from './classes.js';

export type ParseResult = {
  messageBags: ParsedMessageBag[];
  validMessageBags: ParsedMessageBag[]
  i18nMessageBags: ParsedI18NMessageBagResult[];
  locales: string[];
  buildable: boolean;
  unusedI18NDirs: string[];
};

export type MessageBagProp<T extends Node = Node> = {
  key: string;
  objectPath: string;
  propertyAssignment: PropertyAssignment;
  value: T;
  comment: string | null;
};
export type MapProp = MessageBagProp<ObjectLiteralExpression> & {
  properties: MessageBagProp[];
};
export type StringMessageDefinition = MessageBagProp<StringLiteral>;
export type FunctionMessageDefinition = MessageBagProp<ArrowFunction>;

export type ParsedMessageBag = {
  callExpression: CallExpression;
  messageBagId: string;
  properties: MessageBagProp[];
  versionHash: string;
  error: LintError | null;
};

export type ParsedMessageBagTypeFile = {
  messageBagId: string;
  filePath: string;
  fileExists: boolean;
  declarationError: LintError | null;
}

export type ParsedI18NMessageBagResult = {

  messageBagId: string;

  locales: ParsedI18NMessageBagLocaleResult[];
};

export type ParsedI18NMessageBagLocaleResult = {
  locale: string;
  messageBagId: string;
  filePath: string;
  fileExists: boolean;
  declarationError: LintError | null;
  missingMessages: LintError[];
  deprecatedMessages: LintError[];
  invalidMessages: LintError[];
};

export type FlattenedProp = {
  objectPath: string;
  initializer: Expression;
};
