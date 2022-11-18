import {
  ArrowFunction,
  CallExpression,
  Identifier,
  ObjectLiteralExpression,
  Project,
  PropertyAssignment,
  SourceFile,
  StringLiteral,
  SyntaxKind
} from 'ts-morph';
import kleurPkg from 'kleur';
import {
  Call,
  getNodeDetails,
  getStrippedComment,
  LintError,
  type MergedMessageBag,
  type MessageDefinition,
  type ParsedSourceCallsResult,
  type ParsedProjectResult,
  type ParsedLocaleNames
} from './shared.js';
import { extname, basename } from 'node:path';
const { bold, underline, red, green, dim } = kleurPkg;

export const parseProject = (localesToAdd: string[]): ParsedProjectResult => {
  const project = new Project({
    tsConfigFilePath: './tsconfig.json'
  });
  return {
    project,
    sourceCallsResult: parseSourceCalls(project),
    localeNames: parseLocaleNames(project, localesToAdd)
  }
};

const parseLocaleNames = (project: Project, localesToAdd: string[]): ParsedLocaleNames => {
  const files = project.getSourceFiles('src/i18n/**/translations.*.ts');
  const existing = Array.from(new Set(
    files.map(f => {
      const p = f.getFilePath()
      return basename(p, extname(p) ).replace('translations.', '')
    })
  ));
  const all = Array.from(new Set([...existing, ...localesToAdd]));
  const added = all.filter(s => !existing.includes(s))
  return {
    existing,
    added,
    all
  }
}
const getCallExpressionsInFile = (file: SourceFile): CallExpression[] => {
  const importDec = file.getImportDeclaration('skint');
  if (!importDec) {
    return [];
  }
  const ids = importDec
    .getNamedImports()
    .filter((n) => {
      return n.getNameNode().getText() === 't';
    })
    .map((s) => {
      return s.getAliasNode() ? s.getAliasNode() : s.getNameNode();
    });
  const id = ids.find((i) => i !== undefined);
  if (!id) {
    return [];
  }
  const calls: CallExpression[] = [];
  file.forEachDescendant((node) => {
    switch (node.getKind()) {
      case SyntaxKind.CallExpression:
        if (id.getText() === node.getChildAtIndex(0).getText()) {
          calls.push(node as CallExpression);
        }

        break;
    }
    return undefined;
  });
  return calls;
};

const parseSourceCalls = (project: Project): ParsedSourceCallsResult => {
  
  const allFiles = project.getSourceFiles('src/**/*.ts');
  const excludedStart = process.cwd() + '/src/i18n/';
  const sourceFiles = allFiles.filter(
    (f) => !f.compilerNode.fileName.startsWith(excludedStart)
  );

  const callExpressions: CallExpression[] = [];
  sourceFiles.forEach((file) => {
    const results = getCallExpressionsInFile(file);
    callExpressions.push(...results);
  });
  const calls: Call[] = [];
  const callCounts = {
    total: callExpressions.length,
    valid: 0,
    invalid: 0
  };
  callExpressions.forEach((callExpression) => {
    try {
      const call = parseCall(callExpression);
      calls.push(call);
      callCounts.valid++;
    } catch (error) {
      if (error instanceof Call) {
        calls.push(error);
        callCounts.invalid++;
      } else {
        throw error;
      }
    }
  });
  if (callCounts.invalid > 0) {
    return {
      calls,
      callCounts,
      messageBags: []
    };
  }

  const messageBagIds = Array.from(new Set(calls.map((d) => d.messageBagId)));

  const messageBags: MergedMessageBag[] = [];
  for (const messageBagId of messageBagIds) {
    const mergedMessageBag: MergedMessageBag = {
      messageBagId,
      definitions: []
    };
    const callsWithMessageBagId = calls.filter(
      (c) => c.messageBagId === messageBagId
    );
    callsWithMessageBagId.forEach((call) => {
      call.messageDefinitions.forEach((def) => {
        const conflict: MessageDefinition | undefined =
          mergedMessageBag.definitions.find(
            (d) => d.objectPath === def.objectPath
          );
        if (conflict) {
          const cPos = getNodeDetails(conflict.propertyAssignmentNode);
          call.error = new LintError(
            `Duplicate message key "${bold(
              def.objectPath
            )}" for message bag "${bold(def.messageBagId)}". ` +
              `Previously defined in ${underline(cPos.fileName)} (Ln ${
                cPos.line
              }, Col ${cPos.column}.)`,
            def.propertyAssignmentNode
          );
          callCounts.invalid++;
          callCounts.valid--;
        } else {
          mergedMessageBag.definitions.push(def);
        }
      });
    });
    messageBags.push(mergedMessageBag);
  }
  if (callCounts.invalid > 0) {
    return {
      calls,
      callCounts,
      messageBags: []
    };
  }

  return { messageBags, calls, callCounts };
}

/**
 * Return or throws Call
 *
 * @param callExpression CallExpression
 * @returns Call
 * @throws Call
 */
const parseCall = (callExpression: CallExpression): Call => {
  const call = new Call(callExpression);
  try {
    const [idArg, bagArg] = callExpression.getArguments();
    if (!idArg) {
      throw new LintError(
        `Missing ${bold('messageBagId')} argument.`,
        callExpression
      );
    }
    if (SyntaxKind.StringLiteral !== idArg.getKind()) {
      throw new LintError(
        `Argument ${bold('messageBagId')} must be a string literal.`,
        idArg
      );
    }
    call.messageBagId = (idArg as StringLiteral).compilerNode.text;
    const rx = /^[\w-]+$/;
    const segments = call.messageBagId.split('/');
    for (const segment of segments) {
      if (!rx.test(segment)) {
        throw new LintError(
          `Invalid path segment "${bold(segment)}" in "${bold(
            call.messageBagId
          )}". ` +
            `Each path segment in ${bold(
              'messageBagId'
            )} must be at least one character long ` +
            `and can only include letters, numbers, hyphens and underscores.`,
          idArg
        );
      }
    }
    if (!bagArg) {
      throw new LintError(
        `Missing ${bold('messageBag')} argument.`,
        callExpression
      );
    }
    if (SyntaxKind.ObjectLiteralExpression !== bagArg.getKind()) {
      throw new LintError(
        `Argument ${bold('messageBag')} must be an object literal.`,
        bagArg
      );
    }
    call.messageDefinitions = parseMessageBag(
      bagArg as ObjectLiteralExpression,
      '',
      call.messageBagId
    );
    return call;
  } catch (error) {
    if (error instanceof LintError) {
      call.error = error;
      throw call;
    }
    throw error;
  }
};

const parseMessageBag = (
  objNode: ObjectLiteralExpression,
  parentPath: string,
  messageBagId: string
): MessageDefinition[] => {
  const props = objNode.getProperties();
  if (props.length === 0) {
    throw new LintError(`Empty object.`, objNode);
  }
  const messageDefinitions: MessageDefinition[] = [];
  props.forEach((prop) => {
    if (prop.getKind() !== SyntaxKind.PropertyAssignment) {
      throw new LintError(
        `Unsupported assignment: Spread/shorthand assignments or method/accessor declarations are not allowed.`,
        prop
      );
    }
    const id: Identifier | undefined = prop.getChildrenOfKind(
      SyntaxKind.Identifier
    )[0];
    if (!id) {
      throw new LintError(
        `The key must be an identifier, not a quoted string or other expression. `,
        prop
      );
    }
    const objectPath = [parentPath, id.getText()]
      .filter((s) => s.length > 0)
      .join('.');
    const initializer = (prop as PropertyAssignment).getInitializer();
    if (!initializer) {
      throw new LintError(
        `Missing property value for ${bold(objectPath)}. `,
        id
      );
    }
    const comment = getStrippedComment(prop);
    const validateComment = () => {
      if (!comment) {
        throw new LintError(
          `Missing translation description comment for ${bold(objectPath)}.`,
          prop
        );
      }
    };
    const validateStringDef = (): MessageDefinition => {
      const stringLiteral = initializer as StringLiteral;
      if (stringLiteral.compilerNode.text.trim().length === 0) {
        throw new LintError(
          `Invalid string definition for ${bold(
            objectPath
          )}. The string cannot be empty.`,
          stringLiteral
        );
      }
      validateComment();
      return {
        definitionNode: stringLiteral,
        objectPath,
        comment: comment as string,
        messageBagId,
        propertyAssignmentNode: prop as PropertyAssignment
      };
    };
    const validateFunctionDef = (): MessageDefinition => {
      const arrowFunction = initializer as ArrowFunction;
      if (!arrowFunction.getReturnType().isString()) {
        throw new LintError(
          `The function definition for ${bold(
            objectPath
          )} must return a string. ` +
            `Current return type: ${arrowFunction.getReturnType().getText()}`,
          arrowFunction
        );
      }
      const params = arrowFunction.getParameters();
      if (params.length === 0) {
        throw new LintError(
          `The function definition for ${bold(
            objectPath
          )} has no parameters. Use a string definition instead.`,
          arrowFunction
        );
      }
      params.forEach((a) => {
        const typeDecl = a.getTypeNode();
        if (!typeDecl) {
          throw new LintError(
            `The ${a.getName()} parameter for the function definition for ${bold(
              objectPath
            )} must have a type definition.`,
            a
          );
        }
      });
      validateComment();
      return {
        definitionNode: arrowFunction,
        objectPath,
        comment: comment as string,
        messageBagId,
        propertyAssignmentNode: prop as PropertyAssignment
      };
    };
    switch (initializer.getKind()) {
      case SyntaxKind.ObjectLiteralExpression:
        messageDefinitions.push(
          ...parseMessageBag(
            initializer as ObjectLiteralExpression,
            objectPath,
            messageBagId
          )
        );
        break;
      case SyntaxKind.StringLiteral:
        messageDefinitions.push(validateStringDef());
        break;
      case SyntaxKind.ArrowFunction:
        messageDefinitions.push(validateFunctionDef());
        break;
      default:
        throw new LintError(
          `The property at ${bold(
            objectPath
          )}  must be an arrow function, a string literal or a map.`,
          initializer
        );
    }
  });
  return messageDefinitions;
};

