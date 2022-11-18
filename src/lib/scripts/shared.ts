import { ArrowFunction, CallExpression, PropertyAssignment, SourceFile, StringLiteral, ts, type Node, type Project } from 'ts-morph';
import prettier from 'prettier';

export type ParsedProjectResult = {
  project: Project;
  localeNames: ParsedLocaleNames;
  sourceCallsResult: ParsedSourceCallsResult;
};

export type ParsedLocaleNames = {
  all: string[];
  existing: string[];
  added: string[];
};

export type ParsedMessageBag = {
  messageBagId: string;
  needsAddition: boolean;
  needsDeletion: boolean;
  typeFile: ParsedMessageBagTypeFile;
  translationFiles: ParsedMessageBagTranslationFile[]
}
export type ParsedMessageBagTypeFile = {
  messageBagId: string;
  sourceFile: SourceFile;
  needsAddition: boolean;
  needsDeletion: boolean;
}
export type ParsedMessageBagTranslationFile = {
  messageBagId: string;
  locale: string;
  sourceFile: SourceFile;
  needsAddition: boolean;
  needsDeletion: boolean;
}



export type ParsedSourceCallsResult = {
  calls: Call[];
  callCounts: {
    total: number;
    valid: number;
    invalid: number;
  };
  messageBags: MergedMessageBag[];
};

export type LocaleTranslation = {
  locale: string;
  exists: boolean;
};

export type MessageDefinition = {
  messageBagId: string;
  objectPath: string;
  comment: string;
  definitionNode: StringLiteral | ArrowFunction;
  propertyAssignmentNode: PropertyAssignment;
};

export type MergedMessageBag = {
  messageBagId: string;
  definitions: MessageDefinition[];
};

export type NodeDetails = {
  fileName: string;
  line: number;
  column: number;
  lineCol: string;
};

export const getNodeDetails = (node: Node): NodeDetails => {
  const file = node.compilerNode.getSourceFile();
  const fullFileName = file.fileName;
  const fileName = fullFileName.replace(process.cwd() + '/', '');
  const tsPos = ts.getLineAndCharacterOfPosition(
    node.getSourceFile().compilerNode,
    node.compilerNode.getStart()
  );
  return {
    fileName,
    line: tsPos.line + 1,
    column: tsPos.character + 1,
    lineCol: `[Ln ${tsPos.line + 1}, Col ${tsPos.character + 1}]`
  };
};



export const getStrippedComment = (node: Node): string | null => {
  const stripComment = (input: string): string => {
    return input
      .split(`\n`)
      .map((s) => {
        return extractLineContent(s);
      })
      .filter((s, i, arr) => {
        let empty = [...arr.slice(0, i + 1)].map((s) => s.trim().length === 0);
        if (empty.indexOf(false) === -1) {
          return false;
        }
        empty = [...arr.slice(i)].map((s) => s.trim().length === 0);
        if (empty.indexOf(false) === -1) {
          return false;
        }

        return true;
      })
      .join('\n');
  };
  const extractLineContent = (s: string) => {
    const rxStart = /(^\s*\/\/+)|(^\s*\/\*+)|(^\s*\*+)/;
    const rxEnd = /\*+\/\s*$/;
    let trimmed = s.replace(rxEnd, '');
    const startResult = rxStart.exec(trimmed);
    if (startResult) {
      trimmed = trimmed.replace(startResult[0], '');
    }
    return trimmed;
  };

  const unstripped = node.getFullText().slice(0, node.getLeadingTriviaWidth());
  const stripped = stripComment(unstripped);
  return stripped.trim().length === 0 ? null : stripped;
};

export const prettify = async (
  source: string,
  filePath: string
): Promise<string> => {
  const options = (await prettier.resolveConfig(process.cwd())) || {};
  options.filepath = filePath;
  return prettier.format(source, options);
};

export class WrappedASTNode<T extends Node> {
  constructor(private _node: T) {}
  get node(): T {
    return this._node;
  }
  get fullFileName(): string {
    return this._node.compilerNode.getSourceFile().fileName;
  }
  get fileName(): string {
    return this.fullFileName.replace(process.cwd() + '/', '');
  }
  get pos(): { line: number; column: number } {
    const tsPos = ts.getLineAndCharacterOfPosition(
      this._node.getSourceFile().compilerNode,
      this._node.compilerNode.getStart()
    );

    return {
      line: tsPos.line + 1,
      column: tsPos.character + 1
    };
  }
  get line(): number {
    return this.pos.line;
  }
  get column(): number {
    return this.pos.column;
  }
  get lineCol(): string {
    return `[Ln ${this.line}, Col ${this.column}]`;
  }
}
export class LintError<T extends Node> extends WrappedASTNode<T> {
  constructor(public readonly message: string, node: T) {
    super(node);
  }
}
export class Call extends WrappedASTNode<CallExpression> {
  messageBagId = '';
  messageDefinitions: MessageDefinition[] = [];
  error: LintError<Node> | null = null;
  constructor(node: CallExpression) {
    super(node);
  }
}
