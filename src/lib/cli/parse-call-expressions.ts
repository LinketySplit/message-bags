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
import { LintError } from './classes.js';
import { getStrippedNodeComment } from './utils.js';
import type {
  ParseCallExpressionsResult,
  ParsedCallExpression,
  MessageBagProp,
  MapProp,
  FunctionMessageDefinition,
  StringMessageDefinition
} from './types.js';
import { PATH_TO_I18N } from './constants.js';

export const parseCallExpressions = (
  project: Project
): ParseCallExpressionsResult => {
  const parsedCallExpressions: ParsedCallExpression[] = project
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
    })
    .flat()
    .map((callExpression) => {
      const result: ParsedCallExpression = {
        callExpression,
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
              `Invalid path segment "${segment}" in "${result.messageBagId}". ` +
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
  if (parsedCallExpressions.find((c) => c.error !== null)) {
    return {
      valid: false,
      parsedCallExpressions,
      
    };
  }
  return {
    valid: true,
    parsedCallExpressions
  };
};

const parseMessageBagProperty = (
  el: ObjectLiteralElementLike,
  parentPath: string,
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
  const objectPath = getObjectPath(parentPath, key)
  const initializer = (el as PropertyAssignment).getInitializer();
  if (!initializer) {
    throw new LintError(`Missing property value for ${objectPath}. `, id);
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
        `The property at ${objectPath}  must be an arrow function, a string literal or a map. Provided: ${initializer.getType().getText()}`,
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
  const objectPath = getObjectPath(parentPath, key)
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
  const objectPath = getObjectPath(parentPath, key)
  const comment = getStrippedNodeComment(propertyAssignment);
  if (!arrowFunction.getReturnType().isString()) {
    throw new LintError(
      `The function definition for ${objectPath} must return a string. ` +
        `Current return type: ${arrowFunction.getReturnType().getText()}`,
      arrowFunction
    );
  }
  const params = arrowFunction.getParameters();
  /**
   * Getting rid of this constraint. It may be useful to
   * wrap long messages in a function, regardless of paramaters
   */
  // if (params.length === 0) {
  //   throw new LintError(
  //     `The function definition for ${objectPath} has no parameters. Use a string definition instead.`,
  //     arrowFunction
  //   );
  // }
  params.forEach((a) => {
    const typeDecl = a.getTypeNode();
    if (!typeDecl) {
      throw new LintError(
        `The ${a.getName()} parameter for the function definition at ${objectPath} must have a type definition.`,
        a
      );
    }
  });
  if (!comment) {
    throw new LintError(
      `Missing translation description comment for the function definition at ${objectPath}.`,
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
  const objectPath = getObjectPath(parentPath, key)
  const comment = getStrippedNodeComment(propertyAssignment);
  if (stringLiteral.compilerNode.text.trim().length === 0) {
    throw new LintError(
      `Invalid string message definition for the string definition at ${objectPath}. The string cannot be empty.`,
      stringLiteral
    );
  }
  if (!comment) {
    throw new LintError(
      `Missing translation description comment for the string definition at ${objectPath}.`,
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
  return [parentPath, key].filter(s => s.length > 0).join('.')
}