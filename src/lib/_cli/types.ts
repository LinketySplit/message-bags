import type { SourceMapConsumer } from 'source-map';
import type {
  Node,
  ArrowFunction,
  ObjectLiteralExpression,
  PropertyAssignment,
  StringLiteral,
  SyntaxKind,
  CallExpression
} from 'ts-morph';
import type { LintError } from './classes';
import type prettier from 'prettier';

export type PrettierOptions = prettier.Options;

/** Bespoke Types */
export type SourceResult = {
  messageBags: ParsedMessageBag[];
  sourceValid: boolean;
};

export type MessageBagNodeDefinition<T extends Node = Node> = {
  kind:
    | SyntaxKind.ObjectLiteralExpression
    | SyntaxKind.StringLiteral
    | SyntaxKind.ArrowFunction;
  key: string;
  objectPath: string;
  propertyAssignment: PropertyAssignment;
  initializer: T;
  comment: string | null;
  sourceMapConsumer: SourceMapConsumer | undefined;
};
export type MessageBagMapDefinition =
  MessageBagNodeDefinition<ObjectLiteralExpression> & {
    kind: SyntaxKind.ObjectLiteralExpression;
    properties: MessageBagNodeDefinition[];
  };

export type MessageBagStringDefinition =
  MessageBagNodeDefinition<StringLiteral> & {
    kind: SyntaxKind.StringLiteral;
  };
export type MessageBagFunctionDefinition =
  MessageBagNodeDefinition<ArrowFunction> & {
    kind: SyntaxKind.ArrowFunction;
  };

export type ParsedCallExpression = {
  callExpression: CallExpression;
  messageBagId?: string;
  objectLiteral?: ObjectLiteralExpression;
  properties: MessageBagNodeDefinition[];
  sourceMapConsumer: SourceMapConsumer | undefined;
  error: LintError | null;
};
export type ValidParsedCallExpression = ParsedCallExpression & {
  callExpression: CallExpression;
  messageBagId: string;
  objectLiteral: ObjectLiteralExpression;
  error: null;
};

export type ParsedMessageBag = {
  messageBagId: string;
  properties: MessageBagNodeDefinition[];
};
