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

export type ParsedCallExpression = {
  callExpression: CallExpression;
  messageBagId: string;
  properties: MessageBagProp[];
  error: LintError | null;
};
export type ParsedMessageBag = {
  versionHash: string;
  callExpressions: CallExpression[];
  messageBagId: string;
  properties: MessageBagProp[];
};
export type ParseCallExpressionsResult = {
  valid: boolean;
  parsedCallExpressions: ParsedCallExpression[];
  parsedMessageBags: ParsedMessageBag[];
};

export type ParseI18NResult = {
  locales: string[];
  existingMessageBagIds: string[];
}
