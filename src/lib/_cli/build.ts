
import {
  ArrowFunction,
  ObjectLiteralExpression,
  SyntaxKind,
  TypeLiteralNode,
  VariableDeclarationKind,
  type Project,
} from 'ts-morph';

import { lintI18n } from './lint-i18n.js';
import { encloseComment, getPretterOptions, prettify } from './utils.js';
import { lintSourceCallExpressions } from './lint-source-call-expressions.js';
import kleur from 'kleur';
import { FUNCTION_NAME, PATH_TO_I18N, TRANSLATIONS_FILE_NAME, TYPE_FILE_NAME } from './constants.js';
import { createParsedMessageBags } from './create-message-bags.js';
import type { MessageBagMapDefinition, MessageBagNodeDefinition, ParsedMessageBag, PrettierOptions } from './types.js';

export const build = async (
  project: Project,
  locales: string[],
  dryRun: boolean
) => {
  const parsedCallExpressions = await lintSourceCallExpressions(project);
  const errors = parsedCallExpressions.filter((c) => c.error !== null);
  console.log();
  if (errors.length > 0) {
    console.log(
      kleur.red(
        `Found ${errors.length} ${kleur.bold(FUNCTION_NAME)} call${
          errors.length > 1 ? 's' : ''
        } with an error.`
      )
    );
    console.log(kleur.dim('Build cancelled.'));
    return;
  }
  const messageBags = createParsedMessageBags(parsedCallExpressions);
  console.log();
  const prettierOptions = await getPretterOptions();
  console.log(
    kleur.dim(
      `Building translation files in ${PATH_TO_I18N} for locales ${locales}...`
    )
  );
  for (const bag of messageBags) {
    console.log(kleur.dim('-'.repeat(25)));

    const dirPath = `${PATH_TO_I18N}/${bag.messageBagId}`;

    console.log(
      `Writing message bag files for ${kleur.bold(bag.messageBagId)} (${kleur.dim(
        dirPath
      )})`
    );

    const typePath = `${dirPath}/${TYPE_FILE_NAME}.ts`;
    await writeMessageBagTypeFile(project, bag, typePath, prettierOptions, dryRun);
    console.log(`Type file: ${kleur.underline(typePath)}.`);
    for (const locale of locales) {
      const localePath = `${dirPath}/${TRANSLATIONS_FILE_NAME}.${locale}.ts`;
      const written = await writeMessageBagTranslationsFile(
        project,
        bag,
        localePath,
        prettierOptions,
        dryRun
      );
      if (written) {
        console.log(
          `${kleur.green('✓')} Added translations file for locale ${kleur.bold(
            locale
          )}: ${kleur.underline(localePath)}.`
        );
      } else {
        console.log(
          `${kleur.yellow('✗')} Skipped  tranlations file for locale ${kleur.bold(
            locale
          )}: File ${kleur.underline(localePath)} already exists.`
        );
      }
    }
  }
  console.log();
  lintI18n(project, locales);
};




const writeMessageBagTypeFile = async (
  project: Project,
  messageBag: ParsedMessageBag,
  filePath: string,
  prettierOptions: PrettierOptions,
  dryRun: boolean
): Promise<void> => {
  let file = project.getSourceFile(filePath);
  if (!file) {
    file = project.createSourceFile(filePath);
  }
  file.replaceWithText('');
  const typeAlias = file.addTypeAlias({
    name: 'Messages',
    type: '{}',
    isExported: true
  });
  const addMessageBagTypeProperty = (
    mbProp: MessageBagNodeDefinition,
    typeLiteral: TypeLiteralNode
  ) => {
    const comment = getCommentForMbProp(mbProp);
    const propertySignature = typeLiteral.addProperty({
      name: mbProp.key,
      leadingTrivia: comment,
      trailingTrivia: '\n\n'
    });
    if (mbProp.initializer.getKind() === SyntaxKind.StringLiteral) {
      propertySignature.setType('string');
    } else if (mbProp.initializer.getKind() === SyntaxKind.ArrowFunction) {
      const af = mbProp.initializer as ArrowFunction;
      const params = af
        .getParameters()
        .map((p) => p.getText())
        .join(', ');
      propertySignature.setType(`(${params}) => string`);
    } else if (
      mbProp.initializer.getKind() === SyntaxKind.ObjectLiteralExpression
    ) {
      propertySignature.setType('{}');
      const childTypeLiteral =
        propertySignature.getFirstDescendantByKindOrThrow(
          SyntaxKind.TypeLiteral
        );
      (mbProp as MessageBagMapDefinition).properties.forEach((p) => {
        addMessageBagTypeProperty(p, childTypeLiteral);
      });
    }
  };
  const rootTypeLiteral = typeAlias.getFirstDescendantByKindOrThrow(
    SyntaxKind.TypeLiteral
  );
  messageBag.properties.forEach((p) =>
    addMessageBagTypeProperty(p, rootTypeLiteral)
  );
  const prettified = prettify(file.getFullText(), filePath, prettierOptions);
  file.replaceWithText(prettified);
  if (!dryRun) {
    await file.save();
  }
};

const writeMessageBagTranslationsFile = async (
  project: Project,
  messageBag: ParsedMessageBag,
  filePath: string,
  prettierOptions: PrettierOptions,
  dryRun: boolean
): Promise<boolean> => {
  let file = project.getSourceFile(filePath);
  if (file) {
    return false;
  }
  file = project.createSourceFile(filePath);
  file.addImportDeclaration({
    moduleSpecifier: `./${TYPE_FILE_NAME}`,
    isTypeOnly: true,
    namedImports: ['Messages']
  });
  const messagesStatement = file.addVariableStatement({
    declarations: [{ name: 'messages', initializer: '{}' }],
    isExported: true,
    declarationKind: VariableDeclarationKind.Const
  });

  const messagesDeclaration = messagesStatement
    .getDeclarations()
    .find((d) => d.getName() === 'messages');
  if (!messagesDeclaration) {
    // should never happen
    throw new Error('Missing messages declaration');
  }
  messagesDeclaration.setType('Messages');

  const addMessageBagProperty = (
    mbProp: MessageBagNodeDefinition,
    objectLiteral: ObjectLiteralExpression
  ) => {
    const propertyAssignment = objectLiteral.addPropertyAssignment({
      name: mbProp.key,
      initializer:
        mbProp.kind === SyntaxKind.ObjectLiteralExpression
          ? '{}'
          : mbProp.initializer.getText(),
      leadingTrivia: getCommentForMbProp(mbProp),
      trailingTrivia: '\n\n'
    });

    if ((mbProp as MessageBagMapDefinition).properties) {
      const childObjectLiteral =
        propertyAssignment.getFirstDescendantByKindOrThrow(
          SyntaxKind.ObjectLiteralExpression
        );
      (mbProp as MessageBagMapDefinition).properties.forEach((p) =>
        addMessageBagProperty(p, childObjectLiteral)
      );
    }
  };

  const rootObjectLiteral = messagesDeclaration.getInitializerIfKindOrThrow(
    SyntaxKind.ObjectLiteralExpression
  );
  messageBag.properties.forEach((p) =>
    addMessageBagProperty(p, rootObjectLiteral)
  );
  console.log(filePath)
  const prettified = prettify(file.getFullText(), filePath, prettierOptions);
  file.replaceWithText(prettified);
  if (!dryRun) {
    await file.save();
  }
 
  return true;
};

const getCommentForMbProp = (mbProp: MessageBagNodeDefinition): string => {
  let textComment = mbProp.comment || '';
  if (mbProp.initializer.getKind() === SyntaxKind.ObjectLiteralExpression) {
    textComment += `\nMessage Group: "${mbProp.objectPath}"`;
  } else {
    textComment += `\nMessage: "${
      mbProp.objectPath
    }"\n\n Original: \n ${mbProp.initializer.getText()}`;
  }
  return encloseComment(textComment.trim());
};
