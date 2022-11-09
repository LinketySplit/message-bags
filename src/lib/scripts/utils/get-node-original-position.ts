import type { SourceMapConsumer } from "source-map";
import ts from 'typescript';

export const getNodeOriginalPosition = (
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