import { lint } from './lint.js';
import { join } from 'node:path';
import kleurPkg from 'kleur';
import lodashPkg from 'lodash';
import { ensureDir } from 'fs-extra';
import {
  prettify,
  type MergedMessageBag,
  type MessageDefinition
} from './shared.js';
import {
  ArrowFunction,
  Node,
  ObjectLiteralExpression,
  PropertyAssignment,
  PropertySignature,
  SourceFile,
  StructureKind,
  SyntaxKind,
  ts,
  TypeAliasDeclaration,
  TypeLiteralNode,
  VariableDeclarationKind,
  VariableStatement,
  type Project
} from 'ts-morph';
const { red } = kleurPkg;
const { set } = lodashPkg;
export const build = async (localesToAdd: string[]) => {
  const parseResult = lint(localesToAdd);
  if (parseResult.sourceCallsResult.callCounts.invalid > 0) {
    console.log(red('Build cancelled because errors were found.'));
  }
  for (const bag of parseResult.sourceCallsResult.messageBags) {
    const dirName = getMessageBagDir(bag);
    await ensureDir(dirName);
    const tmpFp = join(dirName, 'tmp.ts');
    const tmpFile = parseResult.project.createSourceFile(tmpFp);
    const { typeLiteral, objectLiteral } = getMessageBagExports(
      tmpFile,
      bag
    );
    console.log(objectLiteral.getFullText())
    await writeMessaageBagTypeFile(parseResult.project, typeLiteral, dirName)
    // await writeType(parseResult.project, typeAlias, dirName);
    // for (const locale of parseResult.localeNames.all) {
    //   await writeTranslation(
    //     parseResult.project,
    //     messagesConst,
    //     dirName,
    //     locale
    //   );
    // }
    // console.log(messagesConst.getText());
    // await writeType(parseResult.project, bag);
  }
};

const getMessageBagDir = (bag: MergedMessageBag): string => {
  return join(process.cwd(), 'src', 'i18n', ...bag.messageBagId.split('/'));
};
const writeMessageBagTranslationFile = async (
  project: Project,
  messageConstant: VariableStatement,
  dir: string,
  locale: string
) => {
  const path = join(dir, `translations.${locale}.ts`);
  let file = project.getSourceFile(path);
  if (!file) {
    file = project.createSourceFile(path);
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
  const existingMessagesConst = file.getVariableDeclaration('messages');
  if (existingMessagesConst) {
    file.addVariableStatement({
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: 'messages_new',
          initializer: messageConstant
            .getFirstChildByKind(SyntaxKind.ObjectLiteralExpression)
            ?.getText(),
          type: 'Messages'
        }
      ],
      isExported: true
    });
  } else {
    file.addVariableStatement({
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: 'messages',
          initializer: messageConstant
            .getFirstChildByKind(SyntaxKind.ObjectLiteralExpression)
            ?.getText(),
          type: 'Messages'
        }
      ],
      isExported: true
    });
  }

  // file.replaceWithText(messageConstant.getText());
  file.replaceWithText(await prettify(file.getText(), path));
  await file.save();
};

const writeMessaageBagTypeFile = async (
  project: Project,
  typeLiteral: TypeLiteralNode,
  dir: string
) => {
  const path = join(dir, 'type.ts');
  let file = project.getSourceFile(path);
  if (!file) {
    file = project.createSourceFile(path);
  }
  file.replaceWithText('');
  file.addTypeAlias({
    name: 'Messages',
    type: typeLiteral.getFullText(),
    isExported: true
  })
  file.replaceWithText(await prettify(file.getText(), path));
  await file.save();
};

const getMessageBagExports =  (
  tmpFile: SourceFile,
  bag: MergedMessageBag
): { typeLiteral: TypeLiteralNode; objectLiteral: ObjectLiteralExpression } => {
  const typeAlias = tmpFile.addTypeAlias({
    name: 'Messages',
    type: '{}',
    isExported: true
  });
  const messagesConst = tmpFile.addVariableStatement({
    declarationKind: VariableDeclarationKind.Const, // defaults to "let"
    declarations: [
      {
        name: 'messages',
        initializer: '{}',
        type: 'Messages'
      }
    ],
    isExported: true
  });
  const originTypeLiteral = typeAlias.getFirstChildByKindOrThrow(
    SyntaxKind.TypeLiteral
  );
  const originObjectLiteral = messagesConst.getFirstDescendantByKindOrThrow(
    SyntaxKind.ObjectLiteralExpression
  );
  bag.definitions.forEach((def) => {
    const parts = def.objectPath.split('.');
    const key: string = parts.pop() as string;
    const currentTypeLiteral = ensureTypeLiteral(parts, originTypeLiteral);
    const currentObjectLiteral = ensureObjectLiteral(
      parts,
      originObjectLiteral
    );
    let type = 'undefined';
    if (def.definitionNode.getKind() === SyntaxKind.StringLiteral) {
      type = 'string';
    }
    if (def.definitionNode.getKind() === SyntaxKind.ArrowFunction) {
      const params = (def.definitionNode as ArrowFunction)
        .getParameters()
        .map((p) => {
          return `${p.getName()}: ${p.getType().getText()}`;
        });
      type = `(${params.join(', ')}) => string`;
    }
    const comment = [
      '',
      '/**',
      ...def.comment.split('\n').map((s) => `*${s}`),
      '*/',
      ''
    ].join('\n');
    currentTypeLiteral.addProperty({
      name: key,
      type,
      leadingTrivia: comment
    });
    currentObjectLiteral.addProperty({
      name: key,
      initializer: def.definitionNode.getText(),
      kind: StructureKind.PropertyAssignment,
      leadingTrivia: comment
    });
  });

  return {
    typeLiteral: typeAlias.getFirstDescendantByKindOrThrow(
      SyntaxKind.TypeLiteral
    ),
    objectLiteral: messagesConst.getFirstDescendantByKindOrThrow(
      SyntaxKind.ObjectLiteralExpression
    )
  };
};

const ensureTypeLiteral = (
  a: string[],
  origin: TypeLiteralNode
): TypeLiteralNode => {
  let currentTypeLiteral = origin;
  const slugs = [...a];
  while (slugs.length > 0) {
    const key: string = slugs.shift() as string;
    const existing = currentTypeLiteral
      .getChildSyntaxListOrThrow()
      .getChildrenOfKind(SyntaxKind.PropertySignature)
      .find((c: PropertySignature) => c.getName() === key);
    if (existing) {
      currentTypeLiteral = existing.getFirstChildByKindOrThrow(
        SyntaxKind.TypeLiteral
      );
    } else {
      const sig = currentTypeLiteral.addProperty({
        name: key,
        type: '{}'
      });
      currentTypeLiteral = sig.getFirstChildByKindOrThrow(
        SyntaxKind.TypeLiteral
      );
    }
  }
  return currentTypeLiteral;
};

const ensureObjectLiteral = (
  a: string[],
  origin: ObjectLiteralExpression
): ObjectLiteralExpression => {
  let currentObjectLiteral = origin;
  const slugs = [...a];
  while (slugs.length > 0) {
    const key: string = slugs.shift() as string;
    const existing = currentObjectLiteral
      .getChildSyntaxListOrThrow()
      .getChildrenOfKind(SyntaxKind.PropertyAssignment)
      .find((c: PropertyAssignment) => c.getName() === key);
    if (existing) {
      currentObjectLiteral = existing.getFirstChildByKindOrThrow(
        SyntaxKind.ObjectLiteralExpression
      );
    } else {
      const sig = currentObjectLiteral.addProperty({
        name: key,
        initializer: '{}',
        kind: StructureKind.PropertyAssignment
      });
      currentObjectLiteral = sig.getFirstChildByKindOrThrow(
        SyntaxKind.ObjectLiteralExpression
      );
    }
  }
  return currentObjectLiteral;
};
