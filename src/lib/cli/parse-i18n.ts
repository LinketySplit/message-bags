import {
  ArrowFunction,
  Identifier,
  ObjectLiteralExpression,
  PropertyAssignment,
  PropertySignature,
  SourceFile,
  SyntaxKind,
  TypeLiteralNode,
  VariableDeclarationKind,
  VariableStatement,
  type Project
} from 'ts-morph';
import type {
  MapProp,
  MessageBagProp,
  ParsedMessageBag,
  ParseI18NResult,
  StringMessageDefinition
} from './types';
import { extname, basename, dirname, relative, join } from 'node:path';
import { PATH_TO_I18N, TRANSLATIONS_FILE_NAME } from './constants.js';
import { LintError } from './classes.js';

export const parseI18N = (
  project: Project,
  parsedMessageBags: ParsedMessageBag[],
  ensuredLocales: string[]
): ParseI18NResult => {
  const i18nPath = join(process.cwd(), PATH_TO_I18N);
  const files = project.getSourceFiles(`${PATH_TO_I18N}/**/*.ts`);
  const locales = Array.from(
    new Set([
      ...ensuredLocales,
      ...files
        .map((f) => basename(f.getFilePath()))
        .filter((f) => f.startsWith('translations.'))
        .map((f) => {
          return basename(f, extname(f)).replace('translations.', '');
        })
        .filter((f) => f.length > 0)
    ])
  );

  const existingMessageBagIds = files
    .map((f) => f.getFilePath())
    .filter((f) => basename(f) === 'type.ts')
    .map((f) => relative(i18nPath, f))
    .map((f) => dirname(f))
    .map((f) => dirname(f));
  parsedMessageBags.forEach((b) => {
    parseMessageBagDir(project, b);
  });
  return {
    locales,
    existingMessageBagIds
  };
};

const parseMessageBagDir = (project: Project, messageBag: ParsedMessageBag) => {
  const dirName = join(
    process.cwd(),
    'src',
    'i18n',
    ...messageBag.messageBagId.split('/')
  );
  parseTypeFile(project, messageBag, dirName);
};

const parseTypeFile = (
  project: Project,
  messageBag: ParsedMessageBag,
  dirname: string
) => {
  const filePath = join(dirname, 'type.ts');
  let file = project.getSourceFile(filePath);
  if (!file) {
    file = project.createSourceFile(filePath);
  }
  const oldTypeAlias = file.getTypeAlias('Messages');
  if (oldTypeAlias) {
    oldTypeAlias.remove();
  }

  const addProperty = (p: MessageBagProp, typeLiteral: TypeLiteralNode) => {
    const name: string = p.objectPath.split('.').pop() as string;
    const comment = [
      '/**',
      ...(p.comment || `Message Group`).split('\n').map((s) => ` *${s}`),
      ' */',
      ''
    ].join('\n');
    const propertySignature: PropertySignature = typeLiteral.addProperty({
      name: name,
      leadingTrivia: `\n${comment}`,
      trailingTrivia: '\n\n'
    });

    if (p.value.getKind() === SyntaxKind.ObjectLiteralExpression) {
      propertySignature.setType('{}');
      const keyedTypeLiteral = propertySignature.getFirstChildByKindOrThrow(
        SyntaxKind.TypeLiteral
      );
      (p as MapProp).properties.forEach((c) =>
        addProperty(c, keyedTypeLiteral)
      );
    }
    if (p.value.getKind() === SyntaxKind.StringLiteral) {
      propertySignature.setType('string');
    }
    if (p.value.getKind() === SyntaxKind.ArrowFunction) {
      const params = (p.value as ArrowFunction).getParameters().map((p) => {
        return `${p.getName()}: ${p.getType().getText()}`;
      });
      propertySignature.setType(`(${params.join(', ')}) => string`);
    }
  };
  const typeAliasComment = [
    `Automatically generated type for this message bag. Do not edit!`,
    '',
    `Message Bag Id: ${messageBag.messageBagId}`,
    `Version Hash: ${messageBag.versionHash}`
  ];
  const typeAlias = file.addTypeAlias({
    name: 'Messages',
    type: '{}',
    isExported: true,
    leadingTrivia: [
      '/**',
      ...typeAliasComment.map((s) => ` * ${s}`),
      ' */',
      ''
    ].join('\n')
  });
  const originTypeLiteral = typeAlias.getFirstChildByKindOrThrow(
    SyntaxKind.TypeLiteral
  );

  messageBag.properties.forEach((c) => {
    addProperty(c, originTypeLiteral);
  });
};
const parseTranslationsFile = (
  project: Project,
  messageBag: ParsedMessageBag,
  dirname: string,
  locale: string
) => {
  const validateMap = (
    mapDef: { properties: MessageBagProp[] },
    objectLiteral: ObjectLiteralExpression
  ): LintError[] => {
    const errors: LintError[] = [];
    mapDef.properties.forEach((messageBagProp) => {
      const key: string = messageBagProp.objectPath.split('.').pop() as string;
      const assignment = objectLiteral.getProperty(key);
      if (!assignment) {
        errors.push(
          new LintError(
            `Property ${messageBagProp.objectPath} is missing. This is OK if you want to use the default locale's message definition(s).`,
            objectLiteral
          )
        );
        return;
      }
      if (assignment.getKind() !== SyntaxKind.PropertyAssignment) {
        errors.push(
          new LintError(
            `Property ${messageBagProp.objectPath} must be a property assignment: ` +
              `Spread/shorthand assignments or method/accessor declarations are not allowed.`,
            assignment
          )
        );
        return;
      }
      const id: Identifier | undefined = assignment.getChildrenOfKind(
        SyntaxKind.Identifier
      )[0];
      if (!id) {
        errors.push(
          new LintError(
            `Property ${messageBagProp.objectPath}: The key must be an identifier, not a quoted string or other expression.`,
            assignment
          )
        );
        return;
      }
      const initializer = (assignment as PropertyAssignment).getInitializer();
      if (!initializer) {
        errors.push(
          new LintError(
            `Property ${messageBagProp.objectPath}: Missing property value. `,
            id
          )
        );
        return;
      }
      switch (messageBagProp.value.getKind()) {
        case SyntaxKind.ObjectLiteralExpression:
          if (initializer.getKind() !== SyntaxKind.ObjectLiteralExpression) {
            errors.push(
              new LintError(
                `Property ${messageBagProp.objectPath} must be an object literal. `,
                initializer
              )
            );
            return;
          }
          errors.push(...validateMap((messageBagProp as MapProp).properties.find(), initializer as ObjectLiteralExpression))
      }
    });
  };
  const getObjectLiteral = (
    f: SourceFile
  ): ObjectLiteralExpression | undefined => {
    try {
      const statement = f.getVariableStatementOrThrow('messages');
      statement.getFirstDescendantByKindOrThrow(SyntaxKind.ExportKeyword);
      statement.getFirstDescendantByKindOrThrow(SyntaxKind.ConstKeyword);
      return statement.getFirstDescendantByKindOrThrow(
        SyntaxKind.ObjectLiteralExpression
      );
    } catch (error) {
      return;
    }
  };
  const filePath = join(dirname, `${TRANSLATIONS_FILE_NAME}.${locale}.ts`);
  let file = project.getSourceFile(filePath);
  const fileExists = file !== undefined;
  let fileIsValid = true;
  if (!file) {
    file = project.createSourceFile(filePath);
  } else {
    if (undefined === getObjectLiteral(file)) {
      file.replaceWithText('');
      fileIsValid = false;
    }
  }
  const importDecl = file.getImportDeclaration(
    (d) => d.getModuleSpecifier().getText() === './type'
  );
  if (importDecl) {
    importDecl.remove();
  }
  file.addImportDeclaration({
    moduleSpecifier: './type',
    namedImports: ['Messages'],
    isTypeOnly: true
  });
  let objectLiteral = getObjectLiteral(file);
  if (!objectLiteral) {
    const statement = file.addVariableStatement({
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: 'messages',
          initializer: '{}',
          type: 'Partial<Messages>'
        }
      ],
      isExported: true
    });
    objectLiteral = statement.getFirstDescendantByKindOrThrow(
      SyntaxKind.ObjectLiteralExpression
    );
  }

  const existingConstStatements = file.getVariableStatements();
  const variableDeclarations = file.getVariableDeclarations();
  const existingMessagesConst = variableDeclarations.find((c) => {
    return c.getName() === 'messages';
  });
};
