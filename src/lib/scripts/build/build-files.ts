import { outputFile } from 'fs-extra';
import { join } from 'node:path';
import type { ValidParsedSourceCallResult } from '../types.js';
import { PATH_TO_I18N } from '$lib/shared.js';
import { prettify } from '../utils/prettify.js';
import { TRANSLATION_BAG_TYPE_BASENAME } from '../shared.js';

export const buildFiles = async (
  callResults: ValidParsedSourceCallResult[],
  locales: string[]
) => {
  const messageBagIds = callResults.map((o) => o.messageBagId);
  for (const messageBagId of messageBagIds) {
    const messageBagCallResults = callResults.filter(
      (c) => c.messageBagId === messageBagId
    );
    await writeMessageBagFiles(messageBagCallResults, messageBagId, locales);
  }
};

const writeMessageBagFiles = async (
  messageBagCallResults: ValidParsedSourceCallResult[],
  messageBagId: string,
  locales: string[]
) => {
  await writeMessageBagTypeFile(messageBagCallResults, messageBagId);
  for (const locale of locales) {
    await writeTranslationFile(messageBagCallResults, messageBagId, locale);
  }
};

const writeMessageBagTypeFile = async (
  messageBagCallResults: ValidParsedSourceCallResult[],
  messageBagId: string
) => {
  const decls: string[] = messageBagCallResults.map((c) => {
    let decl = `${c.messageKey}: `;
    if (c.type === 'function') {
      decl += `(data: ${c.fnDataType}) => string,`;
    } else {
      decl += 'string,';
    }
    return [getComment(c), decl].join('\n') + '\n';
  });
  const source = ['export type Messages = {', ...decls, '};'].join('\n');
  const path = join(
    PATH_TO_I18N,
    messageBagId,
    `${TRANSLATION_BAG_TYPE_BASENAME}.ts`
  );
  await outputFile(path, await prettify(source, path));
};
const getComment = (callResult: ValidParsedSourceCallResult): string => {
  return [
    `/**`,
    ...callResult.description.map((s) => {
      return `*${s}`;
    }),
    ` */`
  ].join('\n');
};

const writeTranslationFile = async (
  messageBagCallResults: ValidParsedSourceCallResult[],
  messageBagId: string,
  locale: string
) => {
  const path = join(PATH_TO_I18N, messageBagId, `${locale}.ts`);
  const decls: string[] = messageBagCallResults.map((c) => {
    let decl = `${c.messageKey}: `;
    if (c.type === 'function') {
      decl += `(data: ${c.fnDataType}) => ${c.fnBody},`;
    } else {
      decl += `${c.strBody},`;
    }
    return [getComment(c), decl].join('\n') + '\n';
  });

  const source = [
    `import type { Messages } from './type'`,
    `export const messages: Messages = {`,
    ...decls,
    '};'
  ].join('\n');
  await outputFile(path, await prettify(source, path));
};
