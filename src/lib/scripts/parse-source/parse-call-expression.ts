import type { SourceMapConsumer } from 'source-map';
import ts from 'typescript';
import { FUNC_NAME } from '../shared.js';
import { SkintCallParseError } from '../utils/errors.js';
import { getNodeOriginalPosition } from '../utils/get-node-original-position.js';
import { stripComment } from '../utils/strip-comment.js';
import type { ParsedSourceCallResult } from '../types.js';
import { parseMessageId } from '$lib/shared.js';

export const parseCallExpression = (
  callExpression: ts.CallExpression,
  sourceFilePath: string,
  ast: ts.SourceFile,
  sourceMapConsumer: SourceMapConsumer | null = null
): ParsedSourceCallResult => {
  const result: ParsedSourceCallResult = {
    sourceFilePath,
    ...getNodeOriginalPosition(ast, callExpression, sourceMapConsumer),
    messageId: null,
    messageKey: null,
    messageBagId: null,
    type: null,
    description: null,
    fnBody: null,
    fnDataType: null,
    strBody: null,
    error: null
  };

  try {
    result.messageId = parseCallMessageId(
      callExpression,
      sourceFilePath,
      ast,
      sourceMapConsumer
    );
    const { messageBagId, messageKey} = parseMessageId(result.messageId)
    result.messageBagId = messageBagId;
    result.messageKey = messageKey;
    result.description = parseCallExpressionDescription(
      callExpression,
      sourceFilePath,
      ast,
      sourceMapConsumer
    );
    const { fnBody, fnDataType, strBody, type } = parseCallArgument(
      callExpression,
      sourceFilePath,
      ast,
      sourceMapConsumer
    );
    result.type = type;
    result.strBody = strBody;
    result.fnBody = fnBody;
    result.fnDataType = fnDataType;
    return result;
  } catch (error) {
    if (error instanceof SkintCallParseError) {
      result.error = error;
      return result;
    }
    throw error;
  }
};

const parseCallMessageId = (
  callExpression: ts.CallExpression,
  sourceFilePath: string,
  ast: ts.SourceFile,
  sourceMapConsumer: SourceMapConsumer | null = null
) => {
  const arg = callExpression.arguments[0];

  if (!ts.isStringLiteral(arg)) {
    throw new SkintCallParseError(
      `The first argument to ${FUNC_NAME} (messageId) must be a string.`,
      sourceFilePath,
      callExpression,
      ast,
      sourceMapConsumer
    );
  }
  const messageId = arg.text;
  const parts = messageId.split('/');
  if (parts.length < 2) {
    throw new SkintCallParseError(
      `The messageId must composed of two or more string segments separated by forward slashes. ` +
        `The first segments define the path to the translation group file. ` +
        `The last segement is the identifier for the translation function.`,
      sourceFilePath,
      callExpression,
      ast,
      sourceMapConsumer
    );
  }

  const messageKey = parts.pop() as string;
  const rx = /^[\w-]+$/;
  parts.forEach((p) => {
    if (!rx.test(p)) {
      throw new SkintCallParseError(
        `Invalid path segment "${p}" in the messageId. Path segements must only contain letters, numbers, hyphens and underscores.`,
        sourceFilePath,
        arg,
        ast,
        sourceMapConsumer
      );
    }
  });
  if (!/^[a-z_][\w]*$/i.test(messageKey)) {
    throw new SkintCallParseError(
      `Invalid message key "${messageKey}" in the messageId. This is the final segment in the string. ` +
        `It must be a valid identifier, composed of letters, numbers and the underscore, and starting with a letter or underscore.`,
      sourceFilePath,
      arg,
      ast,
      sourceMapConsumer
    );
  }
  return messageId;
};

const parseCallArgument = (
  callExpression: ts.CallExpression,
  sourceFilePath: string,
  ast: ts.SourceFile,
  sourceMapConsumer: SourceMapConsumer | null = null
): {
  type: 'string' | 'function';
  fnDataType: string | null;
  fnBody: string | null;
  strBody: string | null;
} => {
  let fnDataType: string | null = null;
  let fnBody: string | null = null;
  let type: 'function' | 'string' = 'string';
  let strBody: string | null = null;
  const valueNode: ts.ArrowFunction | ts.StringLiteral | null =
    ts.isArrowFunction(callExpression.arguments[1]) ||
    ts.isStringLiteral(callExpression.arguments[1])
      ? callExpression.arguments[1]
      : null;

  if (!valueNode) {
    throw new SkintCallParseError(
      `The message definition must be a string literal or an arrow function.`,
      sourceFilePath,
      callExpression,
      ast,
      sourceMapConsumer
    );
  }
  if (ts.isArrowFunction(valueNode)) {
    type = 'function';
    const fnNode = valueNode as ts.ArrowFunction;
    if (
      fnNode.parameters.length !== 1 ||
      fnNode.parameters[0].name.getText() !== 'data'
    ) {
      throw new SkintCallParseError(
        `The arrow function must have only one parameter, named "data".`,
        sourceFilePath,
        fnNode.parameters.length > 0 ? fnNode.parameters[0] : fnNode,
        ast,
        sourceMapConsumer
      );
    }
    const paramNode = fnNode.parameters[0];
    const typeLiteral: ts.TypeLiteralNode = paramNode
      .getChildren()
      .find((n) => ts.isTypeLiteralNode(n)) as ts.TypeLiteralNode;
    if (!typeLiteral) {
      throw new SkintCallParseError(
        `The arrow function data parameter must be a typed object.`,
        sourceFilePath,
        fnNode.parameters[0],
        ast,
        sourceMapConsumer
      );
    }
    fnDataType = typeLiteral.getText();
    const body = fnNode.body as ts.TemplateExpression | ts.Block;
    if (!ts.isTemplateExpression(body) && !ts.isBlock(body)) {
      throw new SkintCallParseError(
        `The arrow function body must be either a template literal or a block.`,
        sourceFilePath,
        fnNode.body,
        ast,
        sourceMapConsumer
      );
    }
    fnBody = body.getText();
  } else {
    strBody = valueNode.getText();
  }
  return {
    type,
    fnBody,
    fnDataType,
    strBody
  };
};

const parseCallExpressionDescription = (
  callExpression: ts.CallExpression,
  sourceFilePath: string,
  ast: ts.SourceFile,
  sourceMapConsumer: SourceMapConsumer | null = null
): string[] => {
  const possibleComments = [
    callExpression
      .getFullText()
      .slice(0, callExpression.getLeadingTriviaWidth()),
    ...callExpression.arguments.map((a) => {
      return a.getFullText().slice(0, a.getLeadingTriviaWidth());
    })
  ]
    .map((s) => stripComment(s))
    .filter((s) => s.trim().length > 0);
  if (possibleComments.length > 0) {
    return possibleComments[0].split(`\n`);
  }
  throw new SkintCallParseError(
    `A comment with the description of the translated string is required.`,
    sourceFilePath,
    callExpression,
    ast,
    sourceMapConsumer
  );
};
