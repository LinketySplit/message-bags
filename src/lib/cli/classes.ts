import { ts, type Node } from 'ts-morph';

export class NodeDetails<T extends Node = Node> {
  constructor(private _node: T) {}
  get node(): T {
    return this._node;
  }
  get fileName(): string {
    return this.node.getSourceFile().getFilePath();
  }
  get shortFileName(): string {
    return this.fileName.replace(process.cwd() + '/', '');
  }
  get pos(): { line: number; column: number } {
    // 0-based...
    const tsPos = ts.getLineAndCharacterOfPosition(
      this.node.getSourceFile().compilerNode,
      this.node.compilerNode.getStart()
    );

    return {
      line: tsPos.line + 1,
      column: tsPos.character + 1
    };
  }
  get posString(): string {
    return `[Ln ${this.pos.line}, Col ${this.pos.column}]`;
  }
}

export class LintError extends NodeDetails {
  constructor(private _message: string, node: Node) {
    super(node);
  }
  get message(): string {
    return this._message;
  }
}
