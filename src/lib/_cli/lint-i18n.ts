import {
  SyntaxKind,
  TypeLiteralNode,
  type ObjectLiteralExpression,
  type Project,
  type SourceFile
} from 'ts-morph';
import {
  getMessageBagTypeFilePath,
  getMessageBagTranslationsFilePath
} from './file-paths.js';

import { PATH_TO_I18N, TYPE_FILE_NAME } from './constants.js';
import { LintError } from './classes.js';
import kleur from 'kleur';
import { relative, join } from 'node:path';
import { getObjectPath } from './utils.js';

class MissingPropertyError extends LintError {
  public isMissingProperty = true;
}

export const lintI18n = (project: Project, locales: string[]) => {
  const files = project
    .getSourceFiles(`${PATH_TO_I18N}/**/*.ts`)
    .map((f) => f.getDirectoryPath())
    .map((f) => relative(join(process.cwd(), PATH_TO_I18N), f));
  const messageBagIds = Array.from(new Set(files));
  console.log(
    kleur.dim(
      `Linting ${messageBagIds.length} message bags for ${locales.length} locales.`
    )
  );
  console.log();
  messageBagIds.forEach((id) => {
    lintMessageBag(project, id, locales);
    console.log();
  });
};

const lintMessageBag = (
  project: Project,
  messageBagId: string,
  locales: string[]
) => {
  console.log(
    kleur.dim('Linting message bag id'),
    kleur.bold(messageBagId) + kleur.dim('...')
  );
  const typeFilePath = getMessageBagTypeFilePath(messageBagId);
  const typeFile = project.getSourceFile(typeFilePath);
  let typeLiteral: TypeLiteralNode | undefined;
  if (!typeFile) {
    console.log(
      kleur.red(`✗ Missing type file: ${kleur.underline(typeFilePath)}`)
    );
    console.log(
      kleur.dim('Message bag id'),
      kleur.bold(messageBagId),
      kleur.dim('cannot be linted.')
    );
    return;
  } else {
    try {
      typeLiteral = getMessageBagTypeLiteral(typeFile);
      console.log(
        kleur.green('✓'),
        `Valid type file:`,
        kleur.underline(typeFilePath)
      );
    } catch (error) {
      if (error instanceof LintError) {
        console.log(
          kleur.red(`✗ Invalid type file: ${kleur.underline(typeFilePath)}`)
        );
        console.log(' ', kleur.red(error.message), kleur.dim(error.posString));
        console.log(
          kleur.dim('Message bag id'),
          kleur.bold(messageBagId),
          kleur.dim('cannot be linted.')
        );
        return;
      } else {
        throw error;
      }
    }
  }

  locales.forEach((locale) => {
    const translationsFilePath = getMessageBagTranslationsFilePath(
      messageBagId,
      locale
    );
    const translationsFile = project.getSourceFile(translationsFilePath);
    let objectLiteral: ObjectLiteralExpression | undefined;
    let isPartial: boolean | undefined;
    if (!translationsFile) {
      console.log(
        kleur.red(
          `✗ Missing translations file for locale ${kleur.bold(
            locale
          )}: ${kleur.underline(translationsFilePath)}`
        )
      );
      console.log(
        ' ',
        kleur.dim('Locale'),
        kleur.bold(locale),
        kleur.dim('for message bag id'),
        kleur.bold(messageBagId),
        kleur.dim('cannot be linted.')
      );
      return;
    } else {
      try {
        const result =
          getMessageBagTranslationsFileObjectLiteral(translationsFile);
        isPartial = result.isPartial;
        objectLiteral = result.objectLiteral;
      } catch (error) {
        if (error instanceof LintError) {
          console.log(
            kleur.red(
              `✗ Locale ${kleur.bold(locale)}: ${kleur.underline(
                translationsFilePath
              )}`
            )
          );

          console.log(
            ' ',
            kleur.red(error.message),
            kleur.dim(error.posString)
          );
          console.log(
            ' ',
            kleur.dim('Locale'),
            kleur.bold(locale),
            kleur.dim('for message bag id'),
            kleur.bold(messageBagId),
            kleur.dim('cannot be linted.')
          );
          return;
        } else {
          throw error;
        }
      }
    }

    const errors = compareMessageBagObjectLiteralToTypeLiteral(
      typeLiteral as TypeLiteralNode,
      objectLiteral
    );
    const primaryErrors = errors.filter(
      (e) => e instanceof MissingPropertyError === false
    );
    const missingErrors = errors.filter(
      (e) => e instanceof MissingPropertyError === true
    );
    if (
      (errors.length > 0 && !isPartial) ||
      (isPartial && primaryErrors.length > 0)
    ) {
      console.log(
        kleur.red(
          `✗ Locale ${kleur.bold(locale)}: ${kleur.underline(
            translationsFilePath
          )}`
        )
      );
      (isPartial ? primaryErrors : errors).forEach((e) => {
        console.log('   - ', kleur.red(e.message), kleur.dim(e.posString));
      });
    } else {
      console.log(
        kleur.green('✓'),
        'Locale',
        kleur.bold(locale),
        ':',
        kleur.underline(translationsFilePath)
      );
      if (isPartial && missingErrors.length > 0) {
        console.log(
          ' ',
          kleur.yellow('Missing definitions:'),
          kleur.bold(kleur.yellow(missingErrors.length))
        );
        missingErrors.forEach((e) => {
          console.log(' ', ' ', e.message);
        });
      }
    }
  });
};

const getMessageBagTypeLiteral = (file: SourceFile): TypeLiteralNode => {
  const typeAlias = file.getTypeAlias('Messages');
  if (!typeAlias) {
    throw new LintError(`Missing ${kleur.bold('Messages')} type alias.`, file);
  }
  if (!typeAlias.isExported()) {
    throw new LintError(
      `${kleur.bold('Messages')} type alias must be exported.`,
      file
    );
  }
  const rootTypeLiteral = typeAlias.getFirstDescendantByKind(
    SyntaxKind.TypeLiteral
  );
  if (!rootTypeLiteral) {
    throw new LintError(
      `${kleur.bold('Messages')} type alias must be a type literal.`,
      file
    );
  }
  const validateTypeLiteral = (typeLiteral: TypeLiteralNode) => {
    typeLiteral.getProperties().forEach((propertySignature) => {
      const identifier = typeLiteral.getFirstDescendantByKind(
        SyntaxKind.Identifier
      );
      const propertyName = propertySignature.getName();
      if (!identifier) {
        throw new LintError(
          `The ${kleur.bold(propertyName)} property key must be an identifier.`,
          propertySignature
        );
      }
      const propType = propertySignature.getTypeNode();
      if (!propType) {
        throw new LintError(
          `The ${kleur.bold(
            propertyName
          )} property must be initialized with a type.`,
          propertySignature
        );
      }
      if (propType.getKind() === SyntaxKind.TypeLiteral) {
        validateTypeLiteral(propType.asKindOrThrow(SyntaxKind.TypeLiteral));
        return;
      }
      if (propType.getKind() === SyntaxKind.StringKeyword) {
        return;
      }
      if (propType.getKind() === SyntaxKind.FunctionType) {
        const functionType = propType.asKindOrThrow(SyntaxKind.FunctionType);
        if (functionType.getReturnType().getText() !== 'string') {
          throw new LintError(
            `The ${kleur.bold(
              propertyName
            )} function must have a return type of ${kleur.bold('string')}.`,
            propertySignature
          );
        }
        functionType.getParameters().forEach((p) => {
          const t = p.getType();

          if (!t) {
            throw new LintError(
              `The ${kleur.bold(
                p.getName()
              )} function parameter must have a type.`,
              propertySignature
            );
          }
        });
        return;
      }
      throw new LintError(
        `The ${kleur.bold(
          propertyName
        )} property type must be a type literal, a string or a function.`,
        propertySignature
      );
    });
  };
  validateTypeLiteral(rootTypeLiteral);
  return rootTypeLiteral;
};

const getMessageBagTranslationsFileObjectLiteral = (
  file: SourceFile
): { objectLiteral: ObjectLiteralExpression; isPartial: boolean } => {
  let isPartial: boolean;
  const importStatement = file.getImportDeclaration(`./${TYPE_FILE_NAME}`);
  const importTemplate = kleur.bold(`import type { Messages } from './type';`);
  if (!importStatement) {
    throw new LintError(
      `Missing ${kleur.bold(
        'Messages'
      )} type import. The file should include ${importTemplate}.`,
      file
    );
  }
  if (!importStatement.isTypeOnly) {
    throw new LintError(
      `Invalid ${kleur.bold(
        'Messages'
      )} type import. The import should be ${importTemplate}.`,
      importStatement
    );
  }
  const named = importStatement
    .getNamedImports()
    .find((ni) => ni.getName() === 'Messages');
  if (!named) {
    throw new LintError(
      `Invalid ${kleur.bold(
        'Messages'
      )} type import. should be ${importTemplate}.`,
      importStatement
    );
  }
  const messagesStatement = file.getVariableStatement('messages');
  if (!messagesStatement) {
    throw new LintError(
      `The file must export a const named ${kleur.bold('messages')}.`,
      file
    );
  }
  if (!messagesStatement.isExported()) {
    throw new LintError(
      `The ${kleur.bold('messages')} const must be exported.`,
      messagesStatement
    );
  }

  const messagesDeclaration = messagesStatement
    .getDeclarations()
    .find((d) => d.getName() === 'messages');
  if (!messagesDeclaration) {
    // should never happen
    throw new Error('Unexpectedly could not find the declaration.');
  }
  const typeNode = messagesDeclaration.getTypeNode();
  if (!typeNode) {
    throw new LintError(
      `The ${kleur.bold('messages')} const must be typed.`,
      messagesDeclaration
    );
  }
  switch (typeNode.getText()) {
    case 'Partial<Messages>':
      isPartial = true;
      break;
    case 'Messages':
      isPartial = false;
      break;
    default:
      throw new LintError(
        `The ${kleur.bold('messages')} const must be typed as ${kleur.bold(
          'Messages'
        )} or ${kleur.bold('Partial<Messages>')}.`,
        messagesDeclaration
      );
  }
  const objectLiteral = messagesDeclaration.getInitializerIfKind(
    SyntaxKind.ObjectLiteralExpression
  );
  if (!objectLiteral) {
    throw new LintError(
      `The ${kleur.bold('messages')} constant must be an object literal.`,
      messagesDeclaration
    );
  }
  return { objectLiteral, isPartial };
};

const compareMessageBagObjectLiteralToTypeLiteral = (
  rootTypeLiteral: TypeLiteralNode,
  rootObjectLiteral: ObjectLiteralExpression
): LintError[] => {
  const errors: LintError[] = [];
  const compare = (
    typeLiteral: TypeLiteralNode,
    objectLiteral: ObjectLiteralExpression,
    parentPath: string
  ) => {
    typeLiteral.getProperties().forEach((propertySignature) => {
      const propName = propertySignature.getName();
      const objectPath = getObjectPath(parentPath, propName);
      const propSignatureType = propertySignature.getTypeNodeOrThrow();
      let olProp = objectLiteral.getProperty(propName);
      if (!olProp) {
        errors.push(
          new MissingPropertyError(
            `Missing definition for ${kleur.bold(objectPath)}.`,
            objectLiteral
          )
        );
        return;
      }
      if (olProp.getKind() !== SyntaxKind.PropertyAssignment) {
        errors.push(
          new LintError(
            `Invalid property assignment for ${kleur.bold(objectPath)}.`,
            objectLiteral
          )
        );
        return;
      }
      olProp = olProp.asKindOrThrow(SyntaxKind.PropertyAssignment);
      const initializer = olProp.getInitializer();
      if (!initializer) {
        errors.push(
          new LintError(
            `Invalid property assignment for ${kleur.bold(objectPath)}.`,
            objectLiteral
          )
        );
        return;
      }

      if (propSignatureType.getKind() === SyntaxKind.TypeLiteral) {
        if (initializer.getKind() !== SyntaxKind.ObjectLiteralExpression) {
          errors.push(
            new LintError(
              `Invalid definition for ${kleur.bold(
                objectPath
              )}. Expected an object literal. Got: ${initializer.getKindName()}`,
              initializer
            )
          );
          return;
        }
        return compare(
          propSignatureType.asKindOrThrow(SyntaxKind.TypeLiteral),
          initializer.asKindOrThrow(SyntaxKind.ObjectLiteralExpression),
          objectPath
        );
      }
      if (propSignatureType.getKind() === SyntaxKind.StringKeyword) {
        if (initializer.getKind() !== SyntaxKind.StringLiteral) {
          if (initializer.getType().getText() !== 'string') {
            errors.push(
              new LintError(
                `Invalid definition for ${kleur.bold(
                  objectPath
                )}. Expected string. Got: ${initializer.getKindName()}`,
                initializer
              )
            );
          }
        }
        return;
      }
      if (propSignatureType.getKind() === SyntaxKind.FunctionType) {
        if (initializer.getKind() !== SyntaxKind.ArrowFunction) {
          errors.push(
            new LintError(
              `Invalid definition for ${kleur.bold(
                objectPath
              )}. Expected an arrow function. Got: ${initializer.getKindName()}`,
              initializer
            )
          );
          return;
        }
        const arrowFunction = initializer.asKindOrThrow(
          SyntaxKind.ArrowFunction
        );
        const typeFunction = propSignatureType.asKindOrThrow(
          SyntaxKind.FunctionType
        );
        if (arrowFunction.getReturnType().getText() !== 'string') {
          errors.push(
            new LintError(
              `Invalid function definition for ${kleur.bold(
                objectPath
              )}. Must return a string.`,
              arrowFunction
            )
          );
          return;
        }
        const typeParams = typeFunction.getParameters();
        const bagParams = arrowFunction.getParameters();
        for (let i = 0; i < typeParams.length; i++) {
          const typeParam = typeParams[i];
          const bagParam = bagParams[i];
          if (!bagParam) {
            errors.push(
              new LintError(
                `Invalid function definition for ${kleur.bold(
                  objectPath
                )}. Missing parameter ${kleur.bold(typeParam.getName())}.`,
                olProp
              )
            );
            return;
          }
          if (typeParam.getName() !== bagParam.getName()) {
            errors.push(
              new LintError(
                `Invalid function definition for ${kleur.bold(
                  objectPath
                )}. Parameter ${kleur.bold(
                  typeParam.getName()
                )} is misnamed as ${kleur.bold(bagParam.getName())}.`,
                bagParam
              )
            );
            return;
          }
          if (typeParam.getType().getText() !== bagParam.getType().getText()) {
            errors.push(
              new LintError(
                `Invalid function definition for ${kleur.bold(
                  objectPath
                )}. Parameter ${kleur.bold(
                  typeParam.getName()
                )} is mistyped as ${kleur.bold(
                  bagParam.getType().getText()
                )}. It should be typed as  ${kleur.bold(
                  typeParam.getType().getText()
                )}.`,
                bagParam
              )
            );
            return;
          }
        }

        return;
      }
    });
    objectLiteral.getProperties().forEach((el) => {
      if (el.getKind() !== SyntaxKind.PropertyAssignment) {
        return;
      }
      const name = el.asKindOrThrow(SyntaxKind.PropertyAssignment).getName();
      const typeProp = typeLiteral.getProperty(name);
      if (!typeProp) {
        const objectPath = getObjectPath(parentPath, name);
        errors.push(
          new LintError(
            `Deprecated or misplaced definition ${kleur.bold(objectPath)}.`,
            el
          )
        );
      }
    });
  };
  compare(rootTypeLiteral, rootObjectLiteral, '');
  return errors;
};
