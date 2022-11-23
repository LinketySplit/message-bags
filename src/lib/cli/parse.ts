import {
  Identifier,
  Project,
  SyntaxKind,
  type ArrowFunction,
  type CallExpression,
  type ObjectLiteralElementLike,
  type ObjectLiteralExpression,
  type PropertyAssignment,
  type StringLiteral
} from 'ts-morph';
import { Md5 } from 'ts-md5';
import { LintError, NodeDetails } from './classes.js';
import {
  getStrippedNodeComment
} from './utils.js';
import type {
  ParsedMessageBag,
  MessageBagProp,
  MapProp,
  FunctionMessageDefinition,
  StringMessageDefinition,
} from './types.js';
import { PATH_TO_I18N, TRANSLATIONS_FILE_NAME, FUNCTION_NAME } from './constants.js';
import { bold } from './kleur.js';
import { extname, basename } from 'node:path';



export const parseMessageBags = (project: Project): ParsedMessageBag[] => {
  const messageBags: ParsedMessageBag[] = project
    .getSourceFiles('src/**/*.ts')
    .filter((f) => {
      return !f.getFilePath().startsWith(process.cwd() + `/${PATH_TO_I18N}`);
    })
    .map((file): CallExpression[] => {
      const importDec = file.getImportDeclaration('skint');
      if (!importDec) {
        return [];
      }
      const ids = importDec
        .getNamedImports()
        .filter((n) => {
          return n.getNameNode().getText() === FUNCTION_NAME;
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
    })
    .flat()
    .map((callExpression) => {
      const result: ParsedMessageBag = {
        callExpression,
        versionHash: Md5.hashStr(callExpression.getFullText()),
        messageBagId: '',
        properties: [],
        error: null
      };
      try {
        const [idArg, bagArg] = callExpression.getArguments();
        if (!idArg) {
          throw new LintError(`Missing messageBagId argument.`, callExpression);
        }
        if (SyntaxKind.StringLiteral !== idArg.getKind()) {
          throw new LintError(
            `Argument messageBagId must be a string literal.`,
            idArg
          );
        }
        result.messageBagId = (idArg as StringLiteral).compilerNode.text;
        const rx = /^[\w-]+$/;
        const segments = result.messageBagId.split('/');
        for (const segment of segments) {
          if (!rx.test(segment)) {
            throw new LintError(
              `Invalid path segment "${bold(segment)}" in "${bold(
                result.messageBagId
              )}". ` +
                `Each path segment in messageBagId must be at least one character long ` +
                `and can only include letters, numbers, hyphens and underscores.`,
              idArg
            );
          }
        }
        if (!bagArg) {
          throw new LintError(`Missing messageBag argument.`, callExpression);
        }
        if (SyntaxKind.ObjectLiteralExpression !== bagArg.getKind()) {
          throw new LintError(
            `Argument messageBag must be an object literal.`,
            bagArg
          );
        }
        result.properties = (bagArg as ObjectLiteralExpression)
          .getProperties()
          .map((el) => parseMessageBagProperty(el, ''));
      } catch (error) {
        if (error instanceof LintError) {
          result.error = error;
        } else {
          throw error;
        }
      }
      return result;
    });
  if (messageBags.find((c) => c.error !== null)) {
    return messageBags;
  }
  const ids = Array.from(new Set(messageBags.map((c) => c.messageBagId)));
  ids.forEach((id) => {
    const callsWithId = messageBags.filter((c) => c.messageBagId === id);
    for (let i = 0; i < callsWithId.length; i++) {
      const callI = callsWithId[i];
      for (let j = i + 1; j < callsWithId.length; j++) {
        const callJ = callsWithId[j];
        if (callI.messageBagId === callJ.messageBagId) {
          const { shortFileName, posString } = new NodeDetails(
            callI.callExpression
          );
          callJ.error = new LintError(
            `Message bag id "${bold(
              id
            )}" already defined in ${shortFileName} ${posString}. Message bag ids must be unique across a project.`,
            callJ.callExpression
          );
        }
      }
    }
  });

  return messageBags;
};

const parseMessageBagProperty = (
  el: ObjectLiteralElementLike,
  parentPath: string
): MessageBagProp => {
  if (el.getKind() !== SyntaxKind.PropertyAssignment) {
    throw new LintError(
      `Unsupported assignment: Spread/shorthand assignments or method/accessor declarations are not allowed.`,
      el
    );
  }
  const id: Identifier | undefined = el.getChildrenOfKind(
    SyntaxKind.Identifier
  )[0];
  if (!id) {
    throw new LintError(
      `The key must be an identifier, not a quoted string or other expression.`,
      el
    );
  }
  const key = id.getText();
  const objectPath = getObjectPath(parentPath, key);
  const initializer = (el as PropertyAssignment).getInitializer();
  if (!initializer) {
    throw new LintError(`Missing property value for ${bold(objectPath)}. `, id);
  }
  switch (initializer.getKind()) {
    case SyntaxKind.ObjectLiteralExpression:
      return parseMessageBagMap(
        el as PropertyAssignment,
        initializer as ObjectLiteralExpression,
        parentPath,
        key
      );
    case SyntaxKind.ArrowFunction:
      return parseMessageFunctionDefinitionProperty(
        el as PropertyAssignment,
        initializer as ArrowFunction,
        parentPath,
        key
      );
    case SyntaxKind.StringLiteral:
      return parseMessageStringDefinitionProperty(
        el as PropertyAssignment,
        initializer as StringLiteral,
        parentPath,
        key
      );
    default:
      throw new LintError(
        `The property at ${bold(
          objectPath
        )}  must be an arrow function, a string literal or a map. Provided: ${initializer
          .getType()
          .getText()}`,
        initializer
      );
  }
};

const parseMessageBagMap = (
  propertyAssignment: PropertyAssignment,
  objectLiteral: ObjectLiteralExpression,
  parentPath: string,
  key: string
): MapProp => {
  const objectPath = getObjectPath(parentPath, key);
  const properties = objectLiteral
    .getProperties()
    .map((el) => parseMessageBagProperty(el, objectPath));
  return {
    propertyAssignment,
    value: objectLiteral,
    objectPath,
    key,
    properties,
    comment: getStrippedNodeComment(propertyAssignment)
  };
};

const parseMessageFunctionDefinitionProperty = (
  propertyAssignment: PropertyAssignment,
  arrowFunction: ArrowFunction,
  parentPath: string,
  key: string
): FunctionMessageDefinition => {
  const objectPath = getObjectPath(parentPath, key);
  const comment = getStrippedNodeComment(propertyAssignment);
  if (!arrowFunction.getReturnType().isString()) {
    throw new LintError(
      `The function definition for ${bold(objectPath)} must return a string. ` +
        `Current return type: ${arrowFunction.getReturnType().getText()}`,
      arrowFunction
    );
  }
  const params = arrowFunction.getParameters();

  params.forEach((a) => {
    const typeDecl = a.getTypeNode();
    if (!typeDecl) {
      throw new LintError(
        `The ${bold(
          a.getName()
        )} parameter for the function definition at ${bold(
          objectPath
        )} must have a type definition.`,
        a
      );
    }
  });
  if (!comment) {
    throw new LintError(
      `Missing translation description comment for the function definition at ${bold(
        objectPath
      )}.`,
      propertyAssignment
    );
  }
  return {
    propertyAssignment,
    value: arrowFunction,
    objectPath,
    comment,
    key
  };
};

const parseMessageStringDefinitionProperty = (
  propertyAssignment: PropertyAssignment,
  stringLiteral: StringLiteral,
  parentPath: string,
  key: string
): StringMessageDefinition => {
  const objectPath = getObjectPath(parentPath, key);
  const comment = getStrippedNodeComment(propertyAssignment);
  if (stringLiteral.compilerNode.text.trim().length === 0) {
    throw new LintError(
      `Invalid string message definition for the string definition at ${bold(
        objectPath
      )}. The string cannot be empty.`,
      stringLiteral
    );
  }
  if (!comment) {
    throw new LintError(
      `Missing translation description comment for the string definition at ${bold(
        objectPath
      )}.`,
      propertyAssignment
    );
  }
  return {
    propertyAssignment,
    value: stringLiteral,
    objectPath,
    comment,
    key
  };
};

const getObjectPath = (parentPath: string, key: string) => {
  return [parentPath, key].filter((s) => s.length > 0).join('.');
};

export const parseLocales = (
  project: Project,
  ensuredLocales: string | string[]
): string[] => {
  const files = project.getSourceFiles(`${PATH_TO_I18N}/**/*.ts`);
  return Array.from(
    new Set([
      ...(typeof ensuredLocales === 'string'
        ? [ensuredLocales]
        : ensuredLocales),
      ...files
        .map((f) => basename(f.getFilePath()))
        .filter((f) => f.startsWith(TRANSLATIONS_FILE_NAME + '.'))
        .map((f) => {
          return basename(f, extname(f)).replace(
            TRANSLATIONS_FILE_NAME + '.',
            ''
          );
        })
        .filter((f) => f.length > 0)
    ])
  );
};


