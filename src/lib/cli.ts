#!/usr/bin/env node
import sade from 'sade';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import ts from 'typescript';
import { tsquery } from '@phenomnomnominal/tsquery';
import prettier from 'prettier';
import { svelte2tsx } from 'svelte2tsx';
import glob from 'tiny-glob';
import { SourceMapConsumer } from 'source-map';
import { parse as parseComment } from 'comment-parser';
import { bold, cyan, gray, green, red } from 'kleur/colors';
const functionName = 'ski18nT';


const getNodePositionInOriginalSource = (
  ast: ts.SourceFile,
  node: ts.Node,
  sourceMapConsumer: SourceMapConsumer | null = null
): { line: number; column: number } => {
  // this is 0 based
  const tsPos = ts.getLineAndCharacterOfPosition(ast, node.getStart());

  let line = tsPos.line + 1;
  let column = tsPos.character + 1;
  if (sourceMapConsumer) {
    // this is 1-based
    const result = sourceMapConsumer.originalPositionFor({ line, column });
    line = typeof result.line === 'number' ? result.line : -1;
    column = typeof result.column === 'number' ? result.column : -1;
  }
  return {
    line,
    column
  };
};
const prettify = async (source: string, filePath: string): Promise<string> => {
  const options = (await prettier.resolveConfig(process.cwd())) || {};
  options.filepath = filePath;
  return prettier.format(source, options);
};
interface IParseError {
  message: string;
  sourceFilePath: string;
  line: number;
  column: number;
}
class ConflictError implements IParseError {
  constructor(
    public message: string,
    public sourceFilePath: string,
    public line: number,
    public column: number
  ) {}
}
class ParseError implements IParseError {
  public line: number;
  public column: number;
  constructor(
    public message: string,
    public sourceFilePath: string,
    node: ts.Node,
    ast: ts.SourceFile,
    sourceMapConsumer: SourceMapConsumer | null = null
  ) {
    const pos = getNodePositionInOriginalSource(ast, node, sourceMapConsumer);
    this.line = pos.line;
    this.column = pos.column;
  }
}
type FilesResult = {
  callResults: CallResult[];
};
type FileResult = {
  sourceFilePath: string;
  callResults: CallResult[];
};
type CallResult = {
  sourceFilePath: string;
  line: number;
  column: number;
  messageId: string | null;
  type: 'function' | 'string' | null;
  description: string | null;
  fnDataType: string | null;
  fnBody: string | null;
  strBody: string | null;
  error: IParseError| null;
};

const parseSourceFiles = async (): Promise<FilesResult> => {
  const result: FilesResult = {
    callResults: []
  };
  const globPattern = 'src/**/*.{js,svelte,ts}';
  const files = await glob(globPattern);
  for (const sourceFilePath of files) {
    const fileResult = await parseSourceFile(sourceFilePath);
    if (fileResult) {
      result.callResults.push(...fileResult.callResults);
    }
  }
  return result;
};
const parseSourceFile = async (
  sourceFilePath: string
): Promise<FileResult | null> => {
  const result: FileResult = {
    sourceFilePath,
    callResults: []
  };
  const source = await readFile(sourceFilePath, 'utf-8');
  let parsable: string;
  let sourceMapConsumer: SourceMapConsumer | null = null;
  if (extname(sourceFilePath) === '.svelte') {
    const tsx = svelte2tsx(source, { mode: 'ts' });
    tsx.map.sources = [sourceFilePath];
    sourceMapConsumer = await new SourceMapConsumer(tsx.map);
    parsable = tsx.code;
  } else {
    parsable = source;
  }
  const ast = tsquery.ast(parsable);
  const callExpressions: ts.CallExpression[] = tsquery(
    ast,
    'CallExpression'
  ).filter(
    (n) => n.getChildAt(0).getText() === functionName
  ) as ts.CallExpression[];
  if (callExpressions.length === 0) {
    return null;
  }
  for (const callExpression of callExpressions) {
    result.callResults.push(
      parseCallExpression(
        callExpression,
        sourceFilePath,
        ast,
        sourceMapConsumer
      )
    );
  }
  return result;
};
const parseCallExpression = (
  callExpression: ts.CallExpression,
  sourceFilePath: string,
  ast: ts.SourceFile,
  sourceMapConsumer: SourceMapConsumer | null = null
): CallResult => {
  const result: CallResult = {
    sourceFilePath,
    ...getNodePositionInOriginalSource(ast, callExpression, sourceMapConsumer),
    messageId: null,
    type: null,
    description: null,
    fnBody: null,
    fnDataType: null,
    strBody: null,
    error: null
  };
  try {
    result.messageId = parseMessageId(
      callExpression,
      sourceFilePath,
      ast,
      sourceMapConsumer
    );
    result.description = parseCallExpressionDescription(
      callExpression,
      sourceFilePath,
      ast,
      sourceMapConsumer
    );
    const {fnBody, fnDataType, strBody, type} = parseCallArgument(
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
    if (error instanceof ParseError) {
      result.error = error;
      return result;
    }
    throw error;
  }
  
};

const parseMessageId = (
  callExpression: ts.CallExpression,
  sourceFilePath: string,
  ast: ts.SourceFile,
  sourceMapConsumer: SourceMapConsumer | null = null
) => {
  const arg = callExpression.arguments[0];

  if (!ts.isStringLiteral(arg)) {
    throw new ParseError(
      `The first argument to ${functionName} (messageId) must be a string.`,
      sourceFilePath,
      callExpression,
      ast,
      sourceMapConsumer
    );
  }
  const messageId = arg.text;
  const parts = messageId.split('/');
  if (parts.length < 2) {
    throw new ParseError(
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
      throw new ParseError(
        `Invalid path segment "${p}" in the messageId. Path segements must only contain letters, numbers, hyphens and underscores.`,
        sourceFilePath,
        arg,
        ast,
        sourceMapConsumer
      );
    }
  });
  if (!/^[a-z_][\w]*$/i.test(messageKey)) {
    throw new ParseError(
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
    throw new ParseError(
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
      throw new ParseError(
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
      throw new ParseError(
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
      throw new ParseError(
        `The arrow function body must be either a template literal or a block.`,
        sourceFilePath,
        fnNode.body,
        ast,
        sourceMapConsumer
      );
    }
    fnBody = body.getText();
  } else {
    strBody = valueNode.text;
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
): string => {
  const commentResult = parseComment(callExpression.getFullText())[0];
  if (!commentResult) {
    throw new ParseError(
      `A comment with the description of the translated string is required.`,
      sourceFilePath,
      callExpression,
      ast,
      sourceMapConsumer
    );
  }
  return commentResult.source.map((l) => l.source).join('\n');
};

export const lint = async () => {
  const {callResults} = await parseSourceFiles();
  console.log(gray(`${callResults.length} calls to ${functionName} found.`));
  callResults.forEach(r => {
    const fd = `${r.sourceFilePath} [${r.line},${r.column}]`
    if (r.error) {
      console.log( red(`✗ ${fd}`), gray(r.error.message));
    } else {
      console.log( green(`✓ ${fd}`));
    }
  })
};

export const main = () => {
  const prog = sade('skint');

  prog
    .command('lint')
    .describe(
      `Lint the project's message definitions and corresponding translations.`
    )
    .example('lint')
    .action(async (options) => {
      await lint();
    });
  prog.parse(process.argv);
};
main();
