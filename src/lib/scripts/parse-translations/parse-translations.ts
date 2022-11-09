import { PATH_TO_I18N } from '$lib/shared.js';
import glob from 'tiny-glob';
import type { ParsedTranslationFilesResult, ValidParsedSourceCallResult } from '../types.js';
import { basename, extname, dirname } from 'node:path';
import { ensureDir } from 'fs-extra';
export const parseTranslationFiles = async (
  callResults: ValidParsedSourceCallResult[],
  localesToAdd: string[]
): Promise<ParsedTranslationFilesResult> => {
  await ensureDir(PATH_TO_I18N);
  const existingBagDirs = (await glob('**/type.d.ts',  {cwd: PATH_TO_I18N}))
    .map(s => dirname(s));
  const callResultBagDirs = Array.from(new Set(callResults.map(c => c.messageBagId )));
  const newBagDirs = callResultBagDirs.filter(p => !existingBagDirs.includes(p))
  console.log ('existing', existingBagDirs);
  console.log('defined in call results', callResultBagDirs);
  console.log('new', newBagDirs)

  const files = await glob(PATH_TO_I18N + '/**/!(type.d.)ts');
  const localesFound = Array.from(
    new Set<string>(files.map((f) => basename(f, extname(f))))
  );
  const locales = Array.from(new Set([...localesToAdd, ...localesFound]));
  return {
    localesToAdd,
    localesFound,
    locales
  };
};
