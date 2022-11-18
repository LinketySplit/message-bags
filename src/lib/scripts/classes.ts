import {
  ArrowFunction,
  CallExpression,
  Identifier,
  Node,
  ObjectLiteralExpression,
  Project,
  PropertyAssignment,
  SourceFile,
  StringLiteral,
  SyntaxKind,
  ts,
  type ObjectLiteralElementLike
} from 'ts-morph';
import { getStrippedComment } from './shared';
import { extname, basename, relative, dirname, join } from 'node:path';
import kleurPkg from 'kleur';
const { underline } = kleurPkg;
export class NodeDetails<T extends Node> {
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
export class LintError<T extends Node = Node> extends NodeDetails<T> {
  constructor(public readonly message: string, node: T) {
    super(node);
  }
}

export abstract class WrappedASTNode<T extends Node> extends NodeDetails<T> {
  protected abstract getChildErrors(): LintError[];
  protected abstract init(): void;
  private _errors: LintError[] = [];
  constructor(node: T) {
    super(node);
    this.init();
  }
  public addError(message: string, node?: Node): void {
    this._errors.push(new LintError(message, node || this.node));
  }
  public get errors(): LintError[] {
    return [...this._errors, ...this.getChildErrors()];
  }
}

/**
 * A file in the project that may have calls to t
 */
export class CallSourceFile extends WrappedASTNode<SourceFile> {
  private _calls: SourceCall[] = [];

  get calls(): SourceCall[] {
    return this._calls;
  }
  protected getChildErrors(): LintError[] {
    return this.calls.reduce((acc: LintError[], c: SourceCall) => {
      return [...acc, ...c.errors];
    }, []);
  }
  protected init() {
    const importDec = this.node.getImportDeclaration('skint');
    if (!importDec) {
      return;
    }
    const id: string | undefined = importDec
      .getNamedImports()
      .filter((n) => {
        return n.getNameNode().getText() === 't';
      })
      .map((s) => {
        return s.getAliasNode()
          ? s.getAliasNode()?.getText()
          : s.getNameNode().getText();
      })[0];
    if (!id) {
      return;
    }
    const callExpressions: CallExpression[] = [];
    this.node.forEachDescendant((node) => {
      if (node.getKind() === SyntaxKind.CallExpression) {
        const ident = (node as CallExpression).getFirstChildByKind(
          SyntaxKind.Identifier
        );
        if (ident && ident.getText() === id) {
          callExpressions.push(node as CallExpression);
        }
      }
      return undefined;
    });
    callExpressions.forEach((ce) => {
      this.calls.push(new SourceCall(ce));
    });
  }
}

export class SourceCall extends WrappedASTNode<CallExpression> {
  private _messageBagId = '';
  private _messageBag: SourceMessageBag | undefined;

  protected getChildErrors(): LintError[] {
    return this.messageBag ? [...this.messageBag.errors] : [];
  }
  init() {
    const [idArg, bagArg] = this.node.getArguments();
    if (!idArg) {
      return this.addError('Missing messageBagId argument.');
    }
    if (idArg.getKind() !== SyntaxKind.StringLiteral) {
      return this.addError(
        'Argument messageBagId must be a string literal.',
        idArg
      );
    }
    this._messageBagId = (idArg as StringLiteral).compilerNode.text;
    const rx = /^[\w-]+$/;
    const segments = this.messageBagId.split('/');
    for (const segment of segments) {
      if (!rx.test(segment)) {
        this.addError(
          `Invalid path segment "${segment}" in messageBagId "${this.messageBagId}". ` +
            `Each segment must be at least one character long ` +
            `and can only include letters, numbers, hyphens and underscores.`,
          idArg
        );
      }
    }
    if (!bagArg) {
      return this.addError('Missing messageBag argument.');
    }
    if (bagArg.getKind() !== SyntaxKind.ObjectLiteralExpression) {
      return this.addError(
        'Argument messageBag must be an object literal.',
        idArg
      );
    }
  }

  get messageBagId(): string {
    return this._messageBagId;
  }
  get messageBag(): SourceMessageBag | undefined {
    return this._messageBag;
  }
  get translationDefinitions(): SourceTranslationDef<Node>[] {
    return this.messageBag ? this.messageBag.translationDefinitions : [];
  }
}

export class SourceMessageBagProperty extends WrappedASTNode<ObjectLiteralElementLike> {
  private _key = '';
  private _def:
    | SourceMessageBag
    | SourceFunctionTranslationDef
    | SourceStringTranslationDef
    | undefined;
  private _comment: string | null = null;
  constructor(node: ObjectLiteralElementLike, private _parentPath: string) {
    super(node);
  }
  protected getChildErrors(): LintError[] {
    return this.def ? [...this.def.errors] : [];
  }
  protected init(): void {
    this._comment = getStrippedComment(this.node);
    if (this.node.getKind() !== SyntaxKind.PropertyAssignment) {
      return this.addError(
        `Unsupported assignment: Spread/shorthand assignments or method/accessor declarations are not allowed.`
      );
    }
    const id: Identifier | undefined = this.node.getChildrenOfKind(
      SyntaxKind.Identifier
    )[0];
    if (!id) {
      return this.addError(
        `The property key must be an identifier, not a quoted string or other expression.`
      );
    }
    this._key = id.getText();
    const initializer = (this.node as PropertyAssignment).getInitializer();
    if (!initializer) {
      return this.addError(`Missing property value for ${this.objectPath}.`);
    }

    switch (initializer.getKind()) {
      case SyntaxKind.ObjectLiteralExpression:
        this._def = new SourceMessageBag(
          initializer as ObjectLiteralExpression,
          this.objectPath
        );
        break;
      case SyntaxKind.StringLiteral:
        this._def = new SourceStringTranslationDef(
          initializer as StringLiteral,
          this.objectPath
        );
        if (!this.comment) {
          this.addError(
            `Missing translation description comment for the string definition at ${this.objectPath}.`
          );
        }
        break;
      case SyntaxKind.ArrowFunction:
        this._def = new SourceFunctionTranslationDef(
          initializer as ArrowFunction,
          this.objectPath
        );
        if (!this.comment) {
          this.addError(
            `Missing translation description comment for the function definition at ${this.objectPath}.`
          );
        }
        break;
      default:
        this.addError(
          `The property at ${this.objectPath}  must be an arrow function, a string literal or a map.`,
          initializer
        );
    }
  }

  get parentPath(): string {
    return this._parentPath;
  }
  get key(): string {
    return this._key;
  }
  get objectPath(): string {
    return [this.parentPath, this.key].filter((s) => s.length > 0).join('.');
  }
  get def():
    | SourceMessageBag
    | SourceFunctionTranslationDef
    | SourceStringTranslationDef
    | undefined {
    return this._def;
  }
  get comment(): string {
    return this._comment || '';
  }
  get translationDefinitions(): SourceTranslationDef<Node>[] {
    if (this.def instanceof SourceMessageBag) {
      return this.def.translationDefinitions;
    }
    if (this.def instanceof SourceTranslationDef) {
      return [this.def];
    }
    return [];
  }
}

export class SourceMessageBag extends WrappedASTNode<ObjectLiteralExpression> {
  private _properties: SourceMessageBagProperty[] = [];
  constructor(node: ObjectLiteralExpression, private _parentPath: string) {
    super(node);
  }
  protected getChildErrors(): LintError[] {
    return this.properties.reduce(
      (acc: LintError[], c: SourceMessageBagProperty) => {
        return [...acc, ...c.errors];
      },
      []
    );
  }
  protected init(): void {
    const props = this.node.getProperties();
    if (props.length === 0) {
      return this.addError('Empty object literal.');
    }
    this._properties = props.map(
      (p) => new SourceMessageBagProperty(p, this._parentPath)
    );
  }
  get parentPath(): string {
    return this._parentPath;
  }
  get properties(): SourceMessageBagProperty[] {
    return this._properties;
  }
  get translationDefinitions(): SourceTranslationDef<Node>[] {
    return this.properties.reduce(
      (acc: SourceTranslationDef<Node>[], p: SourceMessageBagProperty) => {
        return [...acc, ...p.translationDefinitions];
      },
      []
    );
  }
}

export abstract class SourceTranslationDef<
  T extends Node
> extends WrappedASTNode<T> {
  constructor(node: T, private _objectPath: string) {
    super(node);
  }
  get objectPath(): string {
    return this._objectPath;
  }
}

export class SourceFunctionTranslationDef extends SourceTranslationDef<ArrowFunction> {
  protected getChildErrors(): LintError[] {
    return [];
  }
  protected init(): void {
    if (!this.node.getReturnType().isString()) {
      this.addError(
        `The function definition at ${this.objectPath} must return a string. ` +
          `Current return type: ${this.node.getReturnType().getText()}`
      );
    }
    const params = this.node.getParameters();
    if (params.length === 0) {
      this.addError(
        `The function definition at ${this.objectPath} has no parameters. ` +
          `Use a string definition instead.`
      );
    }
    params.forEach((a) => {
      const typeDecl = a.getTypeNode();
      if (!typeDecl) {
        this.addError(
          `The ${a.getName()} parameter for the function definition at ${
            this.objectPath
          } must be typed.`,
          a
        );
      }
    });
  }
}
export class SourceStringTranslationDef extends SourceTranslationDef<StringLiteral> {
  protected getChildErrors(): LintError[] {
    return [];
  }
  protected init(): void {
    if (this.node.compilerNode.text.trim().length === 0) {
      this.addError(`The string definition at ${this.objectPath} is empty.`);
    }
  }
}
export class ParsedSource {
  private _callSourceFiles: CallSourceFile[] = [];
  constructor(private _project: Project) {
    const allFiles = this._project.getSourceFiles('src/**/*.ts');
    const excludedStart = process.cwd() + '/src/i18n/';
    const sourceFiles = allFiles.filter(
      (f) => !f.compilerNode.fileName.startsWith(excludedStart)
    );
    sourceFiles.forEach((f) => {
      const callSourceFile = new CallSourceFile(f);
      if (callSourceFile.calls.length > 0) {
        this._callSourceFiles.push(callSourceFile);
      }
    });
    this.checkTranslationKeys();
  }
  private checkTranslationKeys() {
    const validCalls = this.validCalls;
    const messageBagIds = Array.from(
      new Set(validCalls.map((c) => c.messageBagId))
    );
    for (const messageBagId of messageBagIds) {
      const included = validCalls.filter(
        (c) => messageBagId === c.messageBagId
      );
      for (let i = 0; i < included.length; i++) {
        const firstCall = included[i];
        const firstDefs = firstCall.translationDefinitions;
        for (let j = i + 1; j < included.length; j++) {
          const secondCall = included[j];
          for (const def of secondCall.translationDefinitions) {
            const conflict = firstDefs.find(
              (d) => d.objectPath === def.objectPath
            );
            if (conflict) {
              def.addError(
                `A translation definition for ${
                  def.objectPath
                } has already been defined at ${underline(conflict.fileName)} ${
                  conflict.lineCol
                }.`
              );
            }
          }
        }
      }
    }
  }
  get project(): Project {
    return this._project;
  }
  get filesWithCalls(): string[] {
    return this._callSourceFiles.map((c) => c.fileName);
  }
  get errors(): LintError[] {
    return this._callSourceFiles.reduce(
      (acc: LintError[], sf: CallSourceFile) => {
        return [...acc, ...sf.errors];
      },
      []
    );
  }
  get calls(): SourceCall[] {
    return this._callSourceFiles.reduce(
      (acc: SourceCall[], sf: CallSourceFile) => {
        return [...acc, ...sf.calls];
      },
      []
    );
  }
  get validCalls(): SourceCall[] {
    return this.calls.filter((c) => c.errors.length === 0);
  }
  get messageBagIds(): string[] {
    return Array.from(new Set(this.validCalls.map((c) => c.messageBagId)));
  }
}

export class ParsedI18N {
  private _i18nFiles: SourceFile[];
  private _existingLocales: string[];
  private _existingMessageBagIds: string[];
  constructor(
    private _project: Project,
    private _parsedSource: ParsedSource,
    private _localesToAdd: string[]
  ) {
    this._i18nFiles = this.project.getSourceFiles('src/i18n/**/*.ts');
    this._existingMessageBagIds = this._i18nFiles
      .filter((f) => basename(f.getFilePath()) === 'type.ts')
      .map((f) => {
        return dirname(relative(f.getFilePath(), 'src/i18n'));
      });
    this._existingLocales = Array.from(
      new Set(
        this._i18nFiles.map((f) => {
          const p = f.getFilePath();
          return basename(p, extname(p)).replace('translations.', '');
        })
      )
    );
  }
  get project(): Project {
    return this._project;
  }
  get parsedSource(): ParsedSource {
    return this._parsedSource;
  }

  get existingMessageBagIds(): string[] {
    return this._existingMessageBagIds;
  }

  get definedMessageBagIds(): string[] {
    return this.parsedSource.messageBagIds;
  }
  get newMessageBagIds(): string[] {
    return this.definedMessageBagIds.filter(
      (id) => !this.existingMessageBagIds.includes(id)
    );
  }
  get staleMessageBagIds(): string[] {
    return this.existingMessageBagIds.filter(
      (id) => !this.definedMessageBagIds.includes(id)
    );
  }
  get localesToAdd(): string[] {
    return this._localesToAdd;
  }

  get existingLocales(): string[] {
    return this._existingLocales;
  }
  get locales(): string[] {
    return Array.from(new Set([...this.existingLocales, ...this.localesToAdd]));
  }
}

export class ParsedI18NMessageBag {
  constructor(
    private _messageBagId: string,
    private _i18nFiles: SourceFile[],
    private _project: Project
  ) {}
  get messageBagId(): string {
    return this._messageBagId;
  }
  get directoryPath(): string {
    return join(process.cwd(), ...this.messageBagId.split('/'));
  }
  get typeFilePath(): string {
    return join(this.directoryPath, 'type.ts');
  }
  get i18nFiles(): SourceFile[] {
    return this._i18nFiles;
  }
  get project(): Project {
    return this._project;
  }
}
