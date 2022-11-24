import {
  ArrowFunction,
  Expression,
  ObjectLiteralExpression,
  PropertyAssignment,
  StringLiteral,
  SyntaxKind,
  VariableDeclarationKind,
  type Project,
  type TypeLiteralNode
} from 'ts-morph';
import {
  PATH_TO_I18N,
  TRANSLATIONS_FILE_NAME,
  TYPE_FILE_NAME
} from './constants.js';
import type {
  ParsedMessageBag,
  MessageBagProp,
  MapProp,
  MessageBagLocaleFileBuildResult,
  MessageBagBuildResult
} from './types.js';
import {
  encloseComment,
  getPretterOptions,
  prettify,
  type PrettierOptions
} from './utils.js';
import { bold } from './kleur.js';
import { LintError, NodeDetails } from './classes.js';

type FlattenedProp = {
  objectPath: string;
  propertyAssignment: PropertyAssignment;
  initializer: Expression;
};

export const build = async (
  project: Project,
  messageBags: ParsedMessageBag[],
  locales: string[],
  dryRun: boolean
): Promise<MessageBagBuildResult[]> => {
  const prettierOptions = await getPretterOptions();
  const results: MessageBagBuildResult[] = [];
  for (const bag of messageBags) {
    results.push(
      await buildMessageBag(project, bag, locales, prettierOptions, dryRun)
    );
  }

  return results;
};

const buildMessageBag = async (
  project: Project,
  messageBag: ParsedMessageBag,
  locales: string[],
  prettierOptions: PrettierOptions,
  dryRun: boolean
): Promise<MessageBagBuildResult> => {
  const result: MessageBagBuildResult = {
    locales: [],
    messageBagId: messageBag.messageBagId,
    typeFilePath: await buildMessageBagTypeFile(
      project,
      messageBag,
      prettierOptions,
      dryRun
    )
  };
  for (const locale of locales) {
    result.locales.push(
      await buildMessageBagLocaleFile(
        project,
        messageBag,
        locale,
        prettierOptions,
        dryRun
      )
    );
  }
  return result;
};

const buildMessageBagTypeFile = async (
  project: Project,
  messageBag: ParsedMessageBag,
  prettierOptions: PrettierOptions,
  dryRun: boolean
): Promise<string> => {
  const filePath = `${PATH_TO_I18N}/${messageBag.messageBagId}/${TYPE_FILE_NAME}.ts`;
  let file = project.getSourceFile(filePath);
  if (!file) {
    file = project.createSourceFile(filePath);
  }
  let typeAlias = file.getTypeAlias('Messages');
  if (typeAlias) {
    typeAlias.remove();
  }
  typeAlias = file.addTypeAlias({
    name: 'Messages',
    type: '{}',
    isExported: true
  });
  const typeLiteral = typeAlias.getFirstDescendantByKindOrThrow(
    SyntaxKind.TypeLiteral
  );
  messageBag.properties.forEach((p) =>
    addMessageBagTypeProperty(p, typeLiteral)
  );
  const prettified = prettify(file.getFullText(), filePath, prettierOptions);
  file.replaceWithText(prettified);
  if (!dryRun) {
    await file.save();
  }

  return filePath;
};

const buildMessageBagLocaleFile = async (
  project: Project,
  messageBag: ParsedMessageBag,
  locale: string,
  prettierOptions: PrettierOptions,
  dryRun: boolean
): Promise<MessageBagLocaleFileBuildResult> => {
  /**
   * 1. make sure the file exists
   * 2. make sure the Messages type import exists
   * 3. make sure the messages constant exists, is exported and is typed, and that the initializer is an ObjectLiteral.
   * 4. loop through the message bag properties comparing them to the constant ObjectLiteral...
   *    - if the property exists in the constant, leave it alone
   *    - if not, add the property as defined in the message bag
   *    - if the definition is an ObjectLiteral and the constant property is an ObjectLiteral
   *        - repeat 4 with the new constant's ObjectLiteral
   *    - else bail
   * 5. compare the root message bag definition to the resulting constant, to get an array of LintErrors
   *    that represents (1) invalid (2) missing and (3) deprecated properties.
   * 6. return this array.
   */
  const result: MessageBagLocaleFileBuildResult = {
    filePath: `${PATH_TO_I18N}/${messageBag.messageBagId}/${TRANSLATIONS_FILE_NAME}.${locale}.ts`,
    locale,
    messageBagId: messageBag.messageBagId,
    invalidFileError: null,
    missingProperties: [],
    invalidProperties: [],
    deprecatedProperties: []
  };
  let file = project.getSourceFile(result.filePath);
  if (!file) {
    file = project.createSourceFile(result.filePath);
  }
  const importStatement = file.getImportDeclaration(`./${TYPE_FILE_NAME}`);
  if (importStatement) {
    importStatement.remove();
  }
  file.addImportDeclaration({
    moduleSpecifier: `./${TYPE_FILE_NAME}`,
    isTypeOnly: true,
    namedImports: ['Messages']
  });

  let messagesStatement = file.getVariableStatement('messages');
  if (!messagesStatement) {
    messagesStatement = file.addVariableStatement({
      declarations: [{ name: 'messages', initializer: '{}' }]
    });
  }
  messagesStatement.setIsExported(true);
  messagesStatement.setDeclarationKind(VariableDeclarationKind.Const);

  const messagesDeclaration = messagesStatement
    .getDeclarations()
    .find((d) => d.getName() === 'messages');
  if (!messagesDeclaration) {
    // should never happen
    throw new Error('Missing messages declaration');
  }
  messagesDeclaration.setType('Messages');
  const rootObjectLiteral = messagesDeclaration.getInitializerIfKind(
    SyntaxKind.ObjectLiteralExpression
  );

  if (!rootObjectLiteral) {
    result.invalidFileError = new LintError(
      `The ${bold('messages')} constant must be an object literal.`,
      messagesDeclaration
    );
    return result;
  }
  messageBag.properties.forEach((mbProp) =>
    addMessageBagProperty(mbProp, rootObjectLiteral)
  );
  const existingObjectIds = flattenMessageBag(messageBag.properties).map(
    (o) => o.objectPath
  );

  flattenObjectLiteral(rootObjectLiteral, '').forEach((op) => {
    if (!existingObjectIds.includes(op.objectPath)) {
      if (op.initializer.getKind() === SyntaxKind.ObjectLiteralExpression) {
        return;
      }
      const replacingNode = op.propertyAssignment.replaceWithText(
        encloseComment(
          ` Undefined or deprecated message definition "${op.objectPath}".`
        ) + op.propertyAssignment.getText()
      );
      if (replacingNode.getKind() === SyntaxKind.PropertyAssignment) {
        op.propertyAssignment = replacingNode as PropertyAssignment;
      } else {
        op.propertyAssignment = replacingNode.getFirstChildByKindOrThrow(
          SyntaxKind.PropertyAssignment
        );
      }
      op.initializer = op.propertyAssignment.getInitializerOrThrow();
    }
  });

  const prettified = prettify(
    file.getFullText(),
    result.filePath,
    prettierOptions
  );
  file.replaceWithText(prettified);

  /**
   * Validate the prettified file.
   */

  const newMessagesDeclaration = file.getVariableDeclarationOrThrow('messages');
  const newObjectLiteral = newMessagesDeclaration.getInitializerIfKind(
    SyntaxKind.ObjectLiteralExpression
  );
  if (!newObjectLiteral) {
    // should never happen
    throw new Error('Missing object literal');
  }
  const flattenedMbProps = flattenMessageBag(messageBag.properties);
  const flattenedOlProps = flattenObjectLiteral(newObjectLiteral, '');

  flattenedMbProps.forEach((mbProp) => {
    const olProp = flattenedOlProps.find(
      (o) => o.objectPath === mbProp.objectPath
    );
    if (!olProp) {
      result.missingProperties.push(
        new LintError(
          `Missing property ${bold(mbProp.objectPath)}.`,
          newObjectLiteral
        )
      );
      return;
    }

    if (olProp.initializer.getKind() !== mbProp.initializer.getKind()) {
      result.invalidProperties.push(
        new LintError(
          `Invalid property ${bold(
            mbProp.objectPath
          )}. Expected ${mbProp.initializer.getKindName()}. Got ${olProp.initializer.getKindName()}.`,
          olProp.initializer
        )
      );
      return;
    }

    if (mbProp.initializer.getKind() === SyntaxKind.StringLiteral) {
      if (
        (olProp.initializer as StringLiteral).compilerNode.text.trim()
          .length === 0
      ) {
        result.invalidProperties.push(
          new LintError(
            `Invalid property ${bold(mbProp.objectPath)}. Empty string.`,
            olProp.initializer
          )
        );
        return;
      }
    }
    if (mbProp.initializer.getKind() === SyntaxKind.ArrowFunction) {
      const mbArrowFunction = mbProp.initializer as ArrowFunction;
      const olArrowFunction = olProp.initializer as ArrowFunction;
      if (!olArrowFunction.getReturnType().isString()) {
        result.invalidProperties.push(
          new LintError(
            `Invalid property ${bold(
              mbProp.objectPath
            )}. Function must return a string.`,
            olProp.initializer
          )
        );
        return;
      }

      const mbParams = mbArrowFunction.getParameters();
      const olParams = olArrowFunction.getParameters();
      for (let i = 0; i < mbParams.length; i++) {
        const mbParam = mbParams[i];
        const olParam = olParams[i];
        if (!olParam) {
          result.invalidProperties.push(
            new LintError(
              `Invalid property ${bold(
                mbProp.objectPath
              )}. Missing parameter ${bold(mbParam.getName())}.`,
              olProp.initializer
            )
          );
          return;
        }
        if (mbParam.getType().getText() !== olParam.getType().getText()) {
          result.invalidProperties.push(
            new LintError(
              `Invalid property ${bold(mbProp.objectPath)}. Parameter ${bold(
                mbParam.getName()
              )} is mistyped.`,
              olProp.initializer
            )
          );
        }
      }
      if (
        mbArrowFunction.getParameters().length !==
        olArrowFunction.getParameters().length
      ) {
        result.invalidProperties.push(
          new LintError(
            `Invalid property ${bold(mbProp.objectPath)}. Too many parameters.`,
            olProp.initializer
          )
        );
      }
    }
  });
  flattenedOlProps.forEach((olProp) => {
    const mbProp = flattenedMbProps.find(
      (o) => o.objectPath === olProp.objectPath
    );
    if (!mbProp) {
      result.deprecatedProperties.push(
        new LintError(
          `Undefined or deprecated message definition ${bold(
            olProp.objectPath
          )}.`,
          olProp.propertyAssignment
        )
      );
    }
  });
  if (!dryRun) {
    await file.save();
  }

  return result;
};

const addMessageBagProperty = (
  mbProp: MessageBagProp,
  objectLiteral: ObjectLiteralExpression
) => {
  let propertyAssignment: PropertyAssignment;
  
  const comment = getCommentForMbProp(mbProp)
  if (!objectLiteral) {
    return;
  }
  const op = objectLiteral.getProperty(mbProp.key);
  if (op) {
    if (op.getKind() !== SyntaxKind.PropertyAssignment) {
      return;
    }

    const initializer = (op as PropertyAssignment).getInitializer();
    if (!initializer) {
      return;
    }
    const initializerText = initializer.getFullText();
    op.remove();
    propertyAssignment = objectLiteral.addPropertyAssignment({
      name: mbProp.key,
      initializer: initializerText,
      leadingTrivia: comment,
      trailingTrivia: '\n\n'
    });
  } else {
    propertyAssignment = objectLiteral.addPropertyAssignment({
      name: mbProp.key,
      initializer: mbProp.value.getFullText(),
      leadingTrivia: comment,
      trailingTrivia: '\n\n'
    });
  }
  if ((mbProp as MapProp).properties) {
    const childObjectLiteral =
      propertyAssignment.getFirstDescendantByKindOrThrow(
        SyntaxKind.ObjectLiteralExpression
      );
    (mbProp as MapProp).properties.forEach((p) =>
      addMessageBagProperty(p, childObjectLiteral)
    );
  }
};

const addMessageBagTypeProperty = (
  mbProp: MessageBagProp,
  typeLiteral: TypeLiteralNode
) => {
  const comment =  getCommentForMbProp(mbProp)
  const propertySignature = typeLiteral.addProperty({
    name: mbProp.key,
    leadingTrivia: comment,
    trailingTrivia: '\n\n'
  });
  if (mbProp.value.getKind() === SyntaxKind.StringLiteral) {
    propertySignature.setType('string');
  } else if (mbProp.value.getKind() === SyntaxKind.ArrowFunction) {
    const af = mbProp.value as ArrowFunction;
    const params = af
      .getParameters()
      .map((p) => p.getText())
      .join(', ');
    propertySignature.setType(`(${params}) => string`);
  } else if (mbProp.value.getKind() === SyntaxKind.ObjectLiteralExpression) {
    propertySignature.setType('{}');
    const childTypeLiteral = propertySignature.getFirstDescendantByKindOrThrow(
      SyntaxKind.TypeLiteral
    );
    (mbProp as MapProp).properties.forEach((p) => {
      addMessageBagTypeProperty(p, childTypeLiteral);
    });
  }
};

const flattenMessageBag = (props: MessageBagProp[]): FlattenedProp[] => {
  const flattened: FlattenedProp[] = [];
  props.forEach((p) => {
    flattened.push({
      objectPath: p.objectPath,
      propertyAssignment: p.propertyAssignment,
      initializer: p.value as Expression
    });
    if ((p as MapProp).properties) {
      flattened.push(...flattenMessageBag((p as MapProp).properties));
    }
  });
  return flattened;
};

const flattenObjectLiteral = (
  ol: ObjectLiteralExpression,
  parentPath: string
): FlattenedProp[] => {
  const flattened: FlattenedProp[] = [];
  ol.getChildrenOfKind(SyntaxKind.PropertyAssignment).forEach((pa) => {
    const name = pa.getName();
    const objectPath = [parentPath, name].filter((s) => s.length > 0).join('.');
    const initializer = pa.getInitializer();
    if (initializer) {
      flattened.push({ objectPath, initializer, propertyAssignment: pa });
      if (initializer.getKind() === SyntaxKind.ObjectLiteralExpression) {
        flattened.push(
          ...flattenObjectLiteral(
            initializer as ObjectLiteralExpression,
            objectPath
          )
        );
      }
    }
  });
  return flattened;
};
const getCommentForMbProp = (mbProp: MessageBagProp): string => {
  let textComment = mbProp.comment || '';
  if (mbProp.value.getKind() === SyntaxKind.ObjectLiteralExpression) {
    textComment += `\nMessage Group: "${mbProp.objectPath}"`
  } else {
    textComment += `\nMessage: "${mbProp.objectPath}"\n\n Untranslated: \n ${mbProp.value.getText()}`;
  };
  return encloseComment(textComment.trim())
}