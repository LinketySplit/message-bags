import {
  ArrowFunction,
  Identifier,
  ObjectLiteralExpression,
  PropertyAssignment,
  PropertySignature,
  SourceFile,
  StructureKind,
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
  ParseResult,
  StringMessageDefinition
} from './types';
import { extname, basename, dirname, relative, join } from 'node:path';
import { PATH_TO_I18N, TRANSLATIONS_FILE_NAME } from './constants.js';
import type { LintError } from './classes.js';
import { prettify } from './utils.js';
import { bold } from './kleur.js';

export const write = async (
  project: Project,
  messageBags: ParsedMessageBag[],
  ensuredLocales: string[],
  dryRun: boolean
): Promise<void> => {
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

  
};

const parseMessageBagDir = async (
  project: Project,
  messageBag: ParsedMessageBag,
  locales: string[],
  dryRun: boolean
) => {
  const dirName = join(
    process.cwd(),
    'src',
    'i18n',
    ...messageBag.messageBagId.split('/')
  );
  console.log(getBagObjectPaths(messageBag.properties));
  await parseTypeFile(project, messageBag, dirName, dryRun);
  for (const locale of locales) {
    await parseTranslationsFile(project, messageBag, dirName, locale, dryRun);
  }
};

const parseTypeFile = async (
  project: Project,
  messageBag: ParsedMessageBag,
  dirname: string,
  dryRun: boolean
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
  if (!dryRun) {
    file.replaceWithText(await prettify(file.getFullText(), filePath));
    await file.save();
  }

  // console.log(file.getFullText())
};

const parseTranslationsFile = async (
  project: Project,
  messageBag: ParsedMessageBag,
  dirname: string,
  locale: string,
  dryRun: boolean
) => {
  const filePath = join(dirname, `${TRANSLATIONS_FILE_NAME}.${locale}.ts`);
  let file = project.getSourceFile(filePath);
  const fileCreated = file === undefined;
  if (!file) {
    file = project.createSourceFile(filePath);
  }
  const importDeclaration = file.getImportDeclaration('./type');
  if (importDeclaration) {
    importDeclaration.remove();
  }
  file.addImportDeclaration({
    moduleSpecifier: './type',
    isTypeOnly: true,
    namedImports: ['Messages']
  });
  const tmpStatement = createTempVariableStatement(file, messageBag);

  if (!dryRun) {
    file.replaceWithText(await prettify(file.getFullText(), filePath));
    await file.save();
  }
};
const createTempVariableStatement = (
  file: SourceFile,
  messageBag: ParsedMessageBag
): VariableStatement => {
  const addProperty = (p: MessageBagProp, ol: ObjectLiteralExpression) => {
    const comment = [
      '/**',
      ...(p.comment || ``).split('\n').map((s) => ` *${s}`),
      ' */',
      ''
    ].join('\n');
    const name: string = p.objectPath.split('.').pop() as string;

    const propertyAssignment: PropertyAssignment = ol.addPropertyAssignment({
      name,
      initializer: '',
      leadingTrivia: comment,
      trailingTrivia: '\n\n'
    });
    if (p.value.getKind() === SyntaxKind.ObjectLiteralExpression) {
      propertyAssignment.setInitializer('{}');
      const keyedObjectLiteral = propertyAssignment.getFirstChildByKindOrThrow(
        SyntaxKind.ObjectLiteralExpression
      );
      (p as MapProp).properties.forEach((c) =>
        addProperty(c, keyedObjectLiteral)
      );
    }
    if (p.value.getKind() === SyntaxKind.StringLiteral) {
      propertyAssignment.setInitializer(p.value.getText());
    }
    if (p.value.getKind() === SyntaxKind.ArrowFunction) {
      propertyAssignment.setInitializer(p.value.getText());
    }
  };

  const constName = `messages`;
  let tmpStatement = file.getVariableStatement(constName);
  if (tmpStatement) {
    tmpStatement.remove();
  }

  tmpStatement = file.addVariableStatement({
    isExported: true,
    declarationKind: VariableDeclarationKind.Const,
    declarations: [
      {
        name: constName,
        type: 'Partial<Messages>',
        initializer: '{}'
      }
    ]
  });
  const rootOl = tmpStatement.getFirstDescendantByKindOrThrow(
    SyntaxKind.ObjectLiteralExpression
  );

  messageBag.properties.forEach((c) => {
    addProperty(c, rootOl);
  });
  console.log(getObjectLiteralPaths(rootOl, ''))
  return tmpStatement;
};

type PropertyValidationResult = {
  property: MessageBagProp;
  exists: boolean;
  lintError?: LintError;
};
// const validateBag = (
//   properties: MessageBagProp[],
//   ol: ObjectLiteralExpression
// ): PropertyValidationResult[] => {
//   properties.forEach((prop) => {
//     validateBagProperty(prop, ol);
//   });
// };

// const validateBagProperty = (
//   property: MessageBagProp,
//   pa: PropertyAssignment
// ): PropertyValidationResult[] => {
//   const initializer = pa.getInitializer();
//   if (!initializer) {
//     return [
//       {
//         property,
//         exists: true,
//         lintError: new LintError(
//           `Missing initializer for ${bold(property.objectPath)}.`,
//           pa
//         )
//       }
//     ];
//   }
//   if (property.value.getKind() !== initializer.getKind()) {
//     return [
//       {
//         property,
//         exists: true,
//         lintError: new LintError(
//           `Invalid definition for ${bold(
//             property.objectPath
//           )}. Received ${initializer.getKindName()}. Expected ${property.value.getKindName()}.`,
//           pa
//         )
//       }
//     ];
//   }
//   if (property.value.getKind() === SyntaxKind.ObjectLiteralExpression) {
//     return validateBag((property as MapProp).properties, initializer as ObjectLiteralExpression );
//   }
//   switch (property.value.getKind()) {
//     case SyntaxKind.ObjectLiteralExpression:

//      break;

//     default:
//       break;
//   }
// };

const getBagObjectPaths = (props: MessageBagProp[]) => {
  const objectPaths: string[] = [];
  props.forEach((p) => {
    objectPaths.push(p.objectPath);
    if ((p as MapProp).properties) {
      objectPaths.push(...getBagObjectPaths((p as MapProp).properties));
    }
  });
  return objectPaths;
};
const getObjectLiteralPaths = (
  ol: ObjectLiteralExpression,
  parentPath: string
) => {
  const objectPaths: string[] = [];
  ol.getChildrenOfKind(SyntaxKind.PropertyAssignment).forEach((pa) => {
    const name = pa.getName();
    const objectPath = [parentPath, name].filter((s) => s.length > 0).join('.');
    objectPaths.push(objectPath);
    if (pa.getInitializer()?.getKind() === SyntaxKind.ObjectLiteralExpression) {
      objectPaths.push(
        ...getObjectLiteralPaths(
          pa.getInitializer() as ObjectLiteralExpression,
          objectPath
        )
      );
    }
  });

  return objectPaths;
};
const findPropertyAssignment = (
  path: string,
  rootOl: ObjectLiteralExpression
): PropertyAssignment | undefined => {
  const slugs = path.split('.');
  const key = slugs.pop() as string;
  let currOl: ObjectLiteralExpression = rootOl;
  while (slugs.length > 0) {
    const slug = slugs.shift() as string;
    const childOlPa = currOl.getProperty(slug);
    if (!childOlPa) {
      return;
    }
    currOl = childOlPa.getFirstDescendantByKind(
      SyntaxKind.ObjectLiteralExpression
    ) as ObjectLiteralExpression;
    if (!currOl) {
      return;
    }
  }
  return currOl.getProperty(key) as PropertyAssignment;
};
