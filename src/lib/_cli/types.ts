import type {
  ArrowFunction,
  CallExpression,
  Node,
  ObjectLiteralExpression,
  PropertyAssignment,
  StringLiteral
} from 'ts-morph';
import type { LintError } from './classes.js';

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

export type MessageBagBuildResult = {
  messageBagId: string;
  typeFilePath: string;
  locales: MessageBagLocaleFileBuildResult[];
};

export type MessageBagLocaleFileBuildResult = {
  messageBagId: string;
  filePath: string;
  locale: string;
  invalidFileError: LintError | null;
  missingProperties: LintError[];
  invalidProperties: LintError[];
  deprecatedProperties: LintError[];
};
