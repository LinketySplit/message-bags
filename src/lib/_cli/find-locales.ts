import type { Project } from 'ts-morph';
import { PATH_TO_I18N, TRANSLATIONS_FILE_NAME } from './constants.js';
import { basename, extname } from 'node:path';

export const findLocales = (
  project: Project,
  ensuredLocales: string | string[]
): string[] => {
  const files = project.getSourceFiles(`${PATH_TO_I18N}/**/*.ts`);
  const ensured = Array.from(
    new Set([
      ...(typeof ensuredLocales === 'string'
        ? [ensuredLocales]
        : ensuredLocales)
    ])
  );
  const existing = Array.from(
    new Set([
      ...files
        .map((f) => basename(f.getFilePath()))
        .filter((f) => f.startsWith(TRANSLATIONS_FILE_NAME + '.'))
        .map((f) => {
          return basename(f, extname(f)).replace(
            TRANSLATIONS_FILE_NAME + '.',
            ''
          );
        })
        .filter((f) => f.length > 0)
    ])
  );
  return Array.from(new Set([...ensured, ...existing]));
};
