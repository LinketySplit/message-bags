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
  ParseI18NResult,
  ParsedMessageBag,
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

