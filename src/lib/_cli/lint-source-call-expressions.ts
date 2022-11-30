import {
  ArrowFunction,
  CallExpression,
  Identifier,
  ObjectLiteralExpression,
  PropertyAssignment,
  StringLiteral,
  SyntaxKind,
  type ObjectLiteralElementLike,
  type Project,
  type SourceFile
} from 'ts-morph';
import type {
  MessageBagFunctionDefinition,
  MessageBagMapDefinition,
  MessageBagNodeDefinition,
  MessageBagStringDefinition,
  ParsedCallExpression
} from './types.js';
import kleur from 'kleur';
import {
  FUNCTION_NAME,
  PACKAGE_NAME,
  PATH_TO_I18N,
  SVELTE_FILE_TMP_SUFFIX
} from './constants.js';
import glob from 'tiny-glob';
import { svelte2tsx } from 'svelte2tsx';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { SourceMapConsumer } from 'source-map';
import { LintError, NodeDetails } from './classes.js';
import { getObjectPath, getStrippedNodeComment } from './utils.js';



export const lintSourceCallExpressions = async (
  project: Project
): Promise<ParsedCallExpression[]> => {
  console.log(kleur.dim(`Finding ${FUNCTION_NAME} calls...`));
  const filenames = (await glob('src/**/*.{svelte,ts,js}')).filter(
    (s) => !s.startsWith(PATH_TO_I18N)
  );
  const parsedCallExpressions: ParsedCallExpression[] = [];
  for (const filename of filenames) {
    let sourceMapConsumer: SourceMapConsumer | undefined;
    let file: SourceFile | undefined;
    if (extname(filename) === '.svelte') {
      const content = await readFile(filename, 'utf-8');
      if (content.indexOf(PACKAGE_NAME) < 0) {
        continue;
      }
      const transformed = svelte2tsx(content, { mode: 'ts' });

      file = project.createSourceFile(
        `${filename}${SVELTE_FILE_TMP_SUFFIX}`,
        transformed.code
      );
      sourceMapConsumer = await new SourceMapConsumer(transformed.map);
    } else {
      file = project.getSourceFile(filename);
      if (!file) {
        continue;
      }
      if (file.getFullText().indexOf(PACKAGE_NAME) < 0) {
        continue;
      }
    }
    const importDecl = file.getImportDeclaration(PACKAGE_NAME);
    if (!importDecl) {
      continue;
    }
    const ids = importDecl
      .getNamedImports()
      .filter((n) => {
        return n.getNameNode().getText() === FUNCTION_NAME;
      })
      .map((s) => {
        return s.getAliasNode() ? s.getAliasNode() : s.getNameNode();
      });
    const id = ids.find((i) => i !== undefined);
    if (!id) {
      continue;
    }
    file.forEachDescendant((node) => {
      switch (node.getKind()) {
        case SyntaxKind.CallExpression:
          if (id.getText() === node.getChildAtIndex(0).getText()) {
            parsedCallExpressions.push(
              parseSourceCallExpression(
                node as CallExpression,
                sourceMapConsumer
              )
            );
          }

          break;
      }
      return undefined;
    });
  }

  parsedCallExpressions.sort((a, b) => {
    const aFp = a.callExpression.getSourceFile().getFilePath();
    const bFp = a.callExpression.getSourceFile().getFilePath();
    if (aFp === bFp) {
      return a.callExpression.getPos() - b.callExpression.getPos();
    }
    return aFp < bFp ? -1 : 1;
  });

  const messageBagIds: string[] = Array.from(
    new Set<string | undefined>(
      parsedCallExpressions
        .filter((c) => typeof c.messageBagId !== undefined)
        .map((c) => c.messageBagId)
    )
  ).filter((s) => s !== undefined) as string[];
  messageBagIds.forEach((messageBagId) => {
    const callsWithId = parsedCallExpressions.filter(
      (p) => p.messageBagId === messageBagId
    );
    for (let a = 0; a < callsWithId.length; a++) {
      const aCall = callsWithId[a];
      if (aCall.error) {
        continue;
      }
      for (let b = a + 1; b < callsWithId.length; b++) {
        const bCall = callsWithId[b];
        if (bCall.error) {
          continue;
        }
        const aProps = flattenMessageBag(aCall.properties);
        const bProps = flattenMessageBag(bCall.properties);
        for (let i = 0; i < aProps.length; i++) {
          const propI = aProps[i];
          for (let j = 0; j < bProps.length; j++) {
            const propJ = bProps[j];
            if (propI.objectPath !== propJ.objectPath) {
              continue;
            }
            if (
              propI.kind !== SyntaxKind.ObjectLiteralExpression ||
              propJ.kind !== SyntaxKind.ObjectLiteralExpression
            ) {
              const propIDetails = new NodeDetails(
                propI.propertyAssignment,
                propI.sourceMapConsumer
              );
              const propJDetails = new NodeDetails(
                propJ.propertyAssignment,
                propJ.sourceMapConsumer
              );

              bCall.error = new LintError(
                `The message definition ${kleur.bold(propJ.objectPath)} ` +
                  `defined in ` +
                  `${kleur.underline(propJDetails.shortFileName)} ` +
                  `${propJDetails.posString} ` +
                  `conflicts with a previous definition in ` +
                  `${kleur.underline(propIDetails.shortFileName)} ` +
                  `${propIDetails.posString}.`,
                propJ.propertyAssignment,
                propJ.sourceMapConsumer
              );
            }
          }
        }
      }
    }
  });
  
  parsedCallExpressions.forEach((c) => {
    const details = new NodeDetails(c.callExpression, c.sourceMapConsumer);
    console.log(
      c.error ? kleur.red('✗') : kleur.green('✓'),
      kleur.underline(
        details.shortFileName
      ),
      kleur.dim(details.posString)
    )
   
    if (c.error) {
      console.log(
        `  ${kleur.red(c.error.message)} ${kleur.dim(c.error.posString)}`
      );
    }
  });
  return parsedCallExpressions;
};

const parseSourceCallExpression = (
  callExpression: CallExpression,
  sourceMapConsumer: SourceMapConsumer | undefined
): ParsedCallExpression => {
  const parsed: ParsedCallExpression = {
    callExpression,
    properties: [],
    error: null,
    sourceMapConsumer
  };
  try {
    const [idArg, messagesArg] = callExpression.getArguments();
    if (!idArg) {
      throw new LintError(
        `Missing ${kleur.bold('messageBagId')} argument.`,
        callExpression,
        sourceMapConsumer
      );
    }
    if (SyntaxKind.StringLiteral !== idArg.getKind()) {
      throw new LintError(
        `Argument ${kleur.bold('messageBagId')} must be a string literal.`,
        idArg,
        sourceMapConsumer
      );
    }
    parsed.messageBagId = (idArg as StringLiteral).compilerNode.text;
    const rx = /^[\w-]+$/;
    const segments = parsed.messageBagId.split('/');
    for (const segment of segments) {
      if (!rx.test(segment)) {
        throw new LintError(
          `Invalid path segment "${kleur.bold(segment)}" in "${kleur.bold(
            parsed.messageBagId
          )}". ` +
            `Each path segment in the id must be at least one character long ` +
            `and can only include letters, numbers, hyphens and underscores.`,
          idArg,
          sourceMapConsumer
        );
      }
    }
    if (!messagesArg) {
      throw new LintError(
        `Missing ${kleur.bold('messages')} argument.`,
        callExpression,
        sourceMapConsumer
      );
    }
    if (SyntaxKind.ObjectLiteralExpression !== messagesArg.getKind()) {
      throw new LintError(
        `Argument  ${kleur.bold('messages')} must be an object literal.`,
        messagesArg,
        sourceMapConsumer
      );
    }
    parsed.objectLiteral = messagesArg as ObjectLiteralExpression;
    parsed.properties = parsed.objectLiteral
      .getProperties()
      .map((el) => parseSourceMessageBagProperty(el, '', sourceMapConsumer))
      .flat();
    return parsed;
  } catch (error) {
    if (error instanceof LintError) {
      parsed.error = error;
      return parsed;
    }
    throw error;
  }
};

const parseSourceMessageBagProperty = (
  el: ObjectLiteralElementLike,
  parentPath: string,
  sourceMapConsumer: SourceMapConsumer | undefined
): MessageBagNodeDefinition => {
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
  const propertyAssignment = el as PropertyAssignment;
  const initializer = propertyAssignment.getInitializer();
  if (!initializer) {
    throw new LintError(
      `Missing property value for ${kleur.bold(objectPath)}. `,
      id
    );
  }
  if (initializer.getKind() === SyntaxKind.ObjectLiteralExpression) {
    const def: MessageBagMapDefinition = {
      kind: SyntaxKind.ObjectLiteralExpression,
      propertyAssignment,
      initializer: initializer as ObjectLiteralExpression,
      objectPath,
      key,
      comment: getStrippedNodeComment(propertyAssignment),
      sourceMapConsumer,
      properties: (initializer as ObjectLiteralExpression)
        .getProperties()
        .map((ole) =>
          parseSourceMessageBagProperty(ole, objectPath, sourceMapConsumer)
        )
    };
    return def;
  }
  if (initializer.getKind() === SyntaxKind.ArrowFunction) {
    const def: MessageBagFunctionDefinition = {
      kind: SyntaxKind.ArrowFunction,
      propertyAssignment,
      initializer: initializer as ArrowFunction,
      objectPath,
      key,
      comment: getStrippedNodeComment(propertyAssignment),
      sourceMapConsumer
    };
    if (!def.initializer.getReturnType().isString()) {
      throw new LintError(
        `The function definition for ${kleur.bold(
          objectPath
        )} must return a string. ` +
          `Current return type: ${def.initializer.getReturnType().getText()}`,
        def.initializer,
        sourceMapConsumer
      );
    }
    const params = def.initializer.getParameters();

    params.forEach((a) => {
      const typeDecl = a.getTypeNode();
      if (!typeDecl) {
        throw new LintError(
          `The ${kleur.bold(
            a.getName()
          )} parameter for the function definition at ${kleur.bold(
            objectPath
          )} must have a type definition.`,
          a,
          sourceMapConsumer
        );
      }
    });
    return def;
  }
  if (initializer.getKind() === SyntaxKind.StringLiteral) {
    const def: MessageBagStringDefinition = {
      kind: SyntaxKind.StringLiteral,
      propertyAssignment,
      initializer: initializer as StringLiteral,
      objectPath,
      key,
      comment: getStrippedNodeComment(propertyAssignment),
      sourceMapConsumer
    };
    if (def.initializer.compilerNode.text.trim().length === 0) {
      throw new LintError(
        `Invalid string message definition for the string definition at ${kleur.bold(
          objectPath
        )}. The string cannot be empty.`,
        def.initializer,
        sourceMapConsumer
      );
    }
    return def;
  }
  throw new LintError(
    `The property at ${kleur.bold(
      objectPath
    )}  must be an arrow function, a string literal or a map. Provided: ${initializer
      .getType()
      .getText()}`,
    initializer,
    sourceMapConsumer
  );
};
const flattenMessageBag = (
  props: MessageBagNodeDefinition[]
): MessageBagNodeDefinition[] => {
  const flattened: MessageBagNodeDefinition[] = [];
  props.forEach((p) => {
    flattened.push(p);
    if ((p as MessageBagMapDefinition).properties) {
      flattened.push(
        ...flattenMessageBag((p as MessageBagMapDefinition).properties)
      );
    }
  });
  return flattened;
};


