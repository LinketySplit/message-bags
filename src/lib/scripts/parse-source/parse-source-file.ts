import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { SourceMapConsumer } from 'source-map';
import { svelte2tsx } from 'svelte2tsx';
import { tsquery } from '@phenomnomnominal/tsquery';
import type ts from 'typescript';


import { FUNC_NAME } from '../shared.js';
import { parseCallExpression } from './parse-call-expression.js';
import type { ParsedSourceFileResult } from '../types.js';

export const parseSourceFile = async (
  sourceFilePath: string
): Promise<ParsedSourceFileResult | null> => {
  const result: ParsedSourceFileResult = {
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
    (n) => n.getChildAt(0).getText() === FUNC_NAME
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
