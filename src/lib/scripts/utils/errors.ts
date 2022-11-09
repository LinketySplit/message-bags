import type { SourceMapConsumer } from 'source-map';
import type ts from 'typescript';
import { getNodeOriginalPosition } from './get-node-original-position.js';
export interface ILintError {
  message: string;
  sourceFilePath: string;
  line: number;
  column: number;
}
export class LintError implements ILintError {
  constructor(
    public message: string,
    public sourceFilePath: string,
    public line: number,
    public column: number
  ) {}
}
export class SkintCallParseError implements ILintError {
  public line: number;
  public column: number;
  constructor(
    public message: string,
    public sourceFilePath: string,
    node: ts.Node,
    ast: ts.SourceFile,
    sourceMapConsumer: SourceMapConsumer | null = null
  ) {
    const pos = getNodeOriginalPosition(ast, node, sourceMapConsumer);
    this.line = pos.line;
    this.column = pos.column;
  }
}
