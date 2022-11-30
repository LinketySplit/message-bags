import type { SourceMapConsumer } from 'source-map';
import type { Node } from 'ts-morph';
import { SVELTE_FILE_TMP_SUFFIX } from './constants.js';
import { relative } from 'node:path';

/** Classes */
export class NodeDetails<T extends Node = Node> {
  constructor(
    private _node: T,
    private _sourceMapConsumer?: SourceMapConsumer
  ) {}
  get node(): T {
    return this._node;
  }

  get fileName(): string {
    let name = this.node.getSourceFile().getFilePath().toString();
    if (name.endsWith(SVELTE_FILE_TMP_SUFFIX)) {
      name = name.substring(0, name.length - SVELTE_FILE_TMP_SUFFIX.length);
    }
    return name;
  }

  get shortFileName(): string {
    return relative(process.cwd(), this.fileName);
  }

  get pos(): { line: number; column: number } {
    const start = this.node.getStart();
    const lineStart = this.node.getStartLinePos();
    const line = this.node.getStartLineNumber();
    const column = start - lineStart + 1;
    if (this._sourceMapConsumer) {
      const mapped = this._sourceMapConsumer.originalPositionFor({
        line,
        column
      });
      return { line: mapped.line || 0, column: mapped.column || 0 };
    }
    return { line, column };
  }
  get posString(): string {
    return `[Ln ${this.pos.line}, Col ${this.pos.column}]`;
  }
}

export class LintError extends NodeDetails {
  constructor(
    private _message: string,
    node: Node,
    sourceMapConsumer?: SourceMapConsumer
  ) {
    super(node, sourceMapConsumer);
  }
  get message(): string {
    return this._message;
  }
}
